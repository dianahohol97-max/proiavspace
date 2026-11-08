import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListMultipartUploadsCommand,
  ListObjectVersionsCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
  UploadPartCommand,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import type {
  MultipartUpload,
  SignedReadUrlOptions,
  StorageObject,
  StorageProvider,
  UnfinishedMultipartUpload,
  UploadedPart,
  UploadUrlOptions,
} from './StorageProvider'
import type { ObjectVersion, PurgeStorage, VersionPage } from './purge'

const DEFAULT_UPLOAD_TTL_SECONDS = 10 * 60
const DEFAULT_READ_TTL_SECONDS = 60 * 60

export interface S3CompatConfig {
  endpoint: string
  region: string
  accessKeyId: string
  secretAccessKey: string
  bucket: string
}

/**
 * Any S3-compatible object storage. Concrete providers below only differ in
 * how the endpoint is built:
 *  - R2Provider — Cloudflare R2 (zero egress; light tiers live here);
 *  - B2Provider — Backblaze B2 (3x cheaper storage, zero egress through the
 *    Bandwidth Alliance CDN; heavy tiers 500 GB+ move here).
 * The bucket needs a CORS rule allowing PUT/GET from the app origin with
 * "etag" exposed — see README.
 */
export class S3CompatProvider implements StorageProvider, PurgeStorage {
  private readonly client: S3Client
  private readonly bucket: string

  constructor(config: S3CompatConfig) {
    this.bucket = config.bucket
    this.client = new S3Client({
      region: config.region,
      endpoint: config.endpoint,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    })
  }

  async getUploadUrl(options: UploadUrlOptions): Promise<{ url: string; key: string }> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: options.key,
      ContentType: options.contentType,
      ContentLength: options.sizeBytes,
    })
    // content-length is part of the signature: the quota gate ran on this
    // exact size, and a PUT of any other size is refused by the storage with
    // 403 instead of landing uncounted in the bucket.
    const url = await getSignedUrl(this.client, command, {
      expiresIn: options.expiresInSeconds ?? DEFAULT_UPLOAD_TTL_SECONDS,
      signableHeaders: options.sizeBytes !== undefined ? new Set(['content-length']) : undefined,
    })
    return { url, key: options.key }
  }

  async getSignedReadUrl(key: string, options?: SignedReadUrlOptions): Promise<string> {
    // Variants (…/v/<uuid>-preview|thumb|poster.jpg) go through the CDN when
    // configured — cached at the edge, fast from any country. The CDN is the
    // Cloudflare Worker in ops/cdn-worker: it serves ONLY …/v/ keys from the
    // private bucket (it signs its own read-only requests) and 404s the rest.
    // Everything else stays presigned: originals (…/o/, CL-04 — a CDN URL is
    // unsigned and lives forever), logos, portfolio originals, social videos,
    // and any forced download.
    const cdn = process.env.MEDIA_CDN_URL
    if (cdn && !options?.downloadFileName && isVariantKey(key)) {
      return `${cdn.replace(/\/+$/, '')}/${key}`
    }

    const expiresIn = options?.expiresInSeconds ?? DEFAULT_READ_TTL_SECONDS
    // Sign at the start of a quarter-TTL window, not at "now": every render in
    // that window hands out the very same URL, so the browser reuses its cached
    // copy instead of downloading the photo again from B2 on each page view
    // (each download is a billed Class B transaction plus egress, and hitting
    // the account cap breaks every image). A URL still lives >= 3/4 of its TTL.
    const windowMs = Math.max(1, Math.floor(expiresIn / 4)) * 1000
    const signingDate = new Date(Math.floor(Date.now() / windowMs) * windowMs)

    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ...(options?.downloadFileName
        ? {
            ResponseContentDisposition: `attachment; filename="${encodeURIComponent(
              options.downloadFileName
            )}"`,
          }
        : // Objects are immutable (a fresh UUID per key), so the browser may
          // keep them for as long as the URL is guaranteed to stay valid.
          { ResponseCacheControl: `private, max-age=${Math.floor((expiresIn * 3) / 4)}` }),
    })
    return getSignedUrl(this.client, command, { expiresIn, signingDate })
  }

  async delete(keys: string[]): Promise<void> {
    if (keys.length === 0) return
    // S3 DeleteObjects caps at 1000 keys per request.
    for (let i = 0; i < keys.length; i += 1000) {
      const chunk = keys.slice(i, i + 1000)
      await this.client.send(
        new DeleteObjectsCommand({
          Bucket: this.bucket,
          Delete: { Objects: chunk.map((key) => ({ Key: key })), Quiet: true },
        })
      )
    }
  }

  async head(key: string): Promise<{ sizeBytes: number; contentType: string | null } | null> {
    try {
      const response = await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: key })
      )
      return {
        sizeBytes: response.ContentLength ?? 0,
        contentType: response.ContentType ?? null,
      }
    } catch (cause) {
      const status = (cause as { $metadata?: { httpStatusCode?: number } }).$metadata
        ?.httpStatusCode
      if (status === 404) return null
      throw cause
    }
  }

  async createMultipartUpload(options: UploadUrlOptions): Promise<MultipartUpload> {
    const response = await this.client.send(
      new CreateMultipartUploadCommand({
        Bucket: this.bucket,
        Key: options.key,
        ContentType: options.contentType,
      })
    )
    if (!response.UploadId) {
      throw new Error('R2 did not return an UploadId for the multipart upload')
    }
    return { uploadId: response.UploadId, key: options.key }
  }

  async getPartUploadUrl(
    key: string,
    uploadId: string,
    partNumber: number,
    expiresInSeconds?: number
  ): Promise<string> {
    const command = new UploadPartCommand({
      Bucket: this.bucket,
      Key: key,
      UploadId: uploadId,
      PartNumber: partNumber,
    })
    return getSignedUrl(this.client, command, {
      expiresIn: expiresInSeconds ?? DEFAULT_UPLOAD_TTL_SECONDS,
    })
  }

  async completeMultipartUpload(
    key: string,
    uploadId: string,
    parts: UploadedPart[]
  ): Promise<void> {
    await this.client.send(
      new CompleteMultipartUploadCommand({
        Bucket: this.bucket,
        Key: key,
        UploadId: uploadId,
        MultipartUpload: {
          Parts: parts.map((part) => ({ PartNumber: part.partNumber, ETag: part.etag })),
        },
      })
    )
  }

  async abortMultipartUpload(key: string, uploadId: string): Promise<void> {
    await this.client.send(
      new AbortMultipartUploadCommand({ Bucket: this.bucket, Key: key, UploadId: uploadId })
    )
  }

  async listMultipartUploads(prefix: string): Promise<UnfinishedMultipartUpload[]> {
    const uploads: UnfinishedMultipartUpload[] = []
    let keyMarker: string | undefined
    let uploadIdMarker: string | undefined
    do {
      const response = await this.client.send(
        new ListMultipartUploadsCommand({
          Bucket: this.bucket,
          Prefix: prefix,
          KeyMarker: keyMarker,
          UploadIdMarker: uploadIdMarker,
        })
      )
      for (const item of response.Uploads ?? []) {
        if (!item.Key || !item.UploadId) continue
        uploads.push({ key: item.Key, uploadId: item.UploadId, initiated: item.Initiated ?? null })
      }
      keyMarker = response.IsTruncated ? response.NextKeyMarker : undefined
      uploadIdMarker = response.IsTruncated ? response.NextUploadIdMarker : undefined
    } while (keyMarker)
    return uploads
  }

  /**
   * One page of every stored version and delete marker under a prefix. B2
   * keeps old versions by default: deleting a key without a VersionId only
   * hides it, the bytes stay (and are billed). Used by the account purge.
   */
  async listObjectVersions(
    prefix: string,
    options: { maxKeys: number; keyMarker?: string; versionIdMarker?: string }
  ): Promise<VersionPage> {
    const response = await this.client.send(
      new ListObjectVersionsCommand({
        Bucket: this.bucket,
        Prefix: prefix,
        MaxKeys: options.maxKeys,
        KeyMarker: options.keyMarker,
        VersionIdMarker: options.versionIdMarker,
      })
    )
    const versions: ObjectVersion[] = []
    for (const item of [...(response.Versions ?? []), ...(response.DeleteMarkers ?? [])]) {
      if (!item.Key) continue
      versions.push({ key: item.Key, versionId: item.VersionId ?? null })
    }
    return {
      versions,
      truncated: response.IsTruncated === true,
      nextKeyMarker: response.NextKeyMarker,
      nextVersionIdMarker: response.NextVersionIdMarker,
    }
  }

  /** Permanently deletes exactly these versions; throws if any is refused. */
  async deleteObjectVersions(versions: ObjectVersion[]): Promise<void> {
    for (let i = 0; i < versions.length; i += 1000) {
      const chunk = versions.slice(i, i + 1000)
      const response = await this.client.send(
        new DeleteObjectsCommand({
          Bucket: this.bucket,
          Delete: {
            Objects: chunk.map((v) => (v.versionId ? { Key: v.key, VersionId: v.versionId } : { Key: v.key })),
            Quiet: true,
          },
        })
      )
      const errors = response.Errors ?? []
      if (errors.length > 0) {
        const first = errors[0]
        throw new Error(
          `B2 refused ${errors.length} of ${chunk.length} deletes (first: ${first.Key ?? '?'} ${first.Code ?? ''} ${first.Message ?? ''})`.trim()
        )
      }
    }
  }

  async list(prefix: string): Promise<StorageObject[]> {
    const objects: StorageObject[] = []
    let continuationToken: string | undefined
    do {
      const response = await this.client.send(
        new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: prefix,
          ContinuationToken: continuationToken,
        })
      )
      for (const item of response.Contents ?? []) {
        if (!item.Key) continue
        objects.push({
          key: item.Key,
          sizeBytes: item.Size ?? 0,
          lastModified: item.LastModified ?? null,
        })
      }
      continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined
    } while (continuationToken)
    return objects
  }
}

export interface R2Config {
  accountId: string
  accessKeyId: string
  secretAccessKey: string
  bucket: string
}

export class R2Provider extends S3CompatProvider {
  constructor(config: R2Config) {
    super({
      endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
      region: 'auto',
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
      bucket: config.bucket,
    })
  }
}

export interface B2Config {
  region: string // e.g. eu-central-003
  keyId: string
  applicationKey: string
  bucket: string
}

export class B2Provider extends S3CompatProvider {
  constructor(config: B2Config) {
    super({
      endpoint: `https://s3.${config.region}.backblazeb2.com`,
      region: config.region,
      accessKeyId: config.keyId,
      secretAccessKey: config.applicationKey,
      bucket: config.bucket,
    })
  }
}

/**
 * Variants live under `…/v/` (see variantKey in ./index.ts and the portfolio
 * presign route); originals under `…/o/`. Only variants may use the CDN.
 */
function isVariantKey(key: string): boolean {
  return /\/v\/[^/]+$/.test(key) && !/\/o\//.test(key)
}
