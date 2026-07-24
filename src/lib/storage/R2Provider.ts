import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
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
  UploadedPart,
  UploadUrlOptions,
} from './StorageProvider'

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
export class S3CompatProvider implements StorageProvider {
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
    })
    const url = await getSignedUrl(this.client, command, {
      expiresIn: options.expiresInSeconds ?? DEFAULT_UPLOAD_TTL_SECONDS,
    })
    return { url, key: options.key }
  }

  async getSignedReadUrl(key: string, options?: SignedReadUrlOptions): Promise<string> {
    // Inline reads (previews, thumbs, posters, covers, logos) go through the
    // CDN when configured — cached at the edge, fast even on a weak connection,
    // and free egress from B2. Forced downloads (originals) stay presigned:
    // short-lived, private, never cached publicly.
    const cdn = process.env.MEDIA_CDN_URL
    if (cdn && !options?.downloadFileName) {
      return `${cdn.replace(/\/+$/, '')}/${key}`
    }

    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ...(options?.downloadFileName
        ? {
            ResponseContentDisposition: `attachment; filename="${encodeURIComponent(
              options.downloadFileName
            )}"`,
          }
        : {}),
    })
    return getSignedUrl(this.client, command, {
      expiresIn: options?.expiresInSeconds ?? DEFAULT_READ_TTL_SECONDS,
    })
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
