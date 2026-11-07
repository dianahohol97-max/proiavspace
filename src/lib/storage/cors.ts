/**
 * The FULL CORS rule set of the media bucket (Backblaze B2, S3 API), applied
 * by /api/admin/storage-cors in one call. A bucket's CORS configuration is
 * replaced as a whole on every write, so this list must always hold every
 * rule the app relies on:
 *
 *   1. uploads — the browser PUTs files and multipart parts straight to B2;
 *      ETag must be exposed so resumable/multipart uploads can read part ETags
 *      (without it they fall back to a server-side ListParts per file);
 *   2. reads — fetch() of presigned originals from the production site:
 *      «Завантажити все» (zip in the browser) and print export of albums.
 *      <img> and <a download> need no CORS; fetch() does.
 *
 * Applying is idempotent: the current rules are read first and nothing is
 * written when they already match. No dependency on any feature code — the
 * same file serves the gallery release and the album builder.
 */

export interface CorsRule {
  AllowedOrigins: string[]
  AllowedMethods: string[]
  AllowedHeaders: string[]
  ExposeHeaders: string[]
  MaxAgeSeconds: number
}

export const PRODUCTION_ORIGINS = ['https://proiav.space', 'https://www.proiav.space']

/** Uploads also from preview deployments and local dev (as before). */
export const UPLOAD_ORIGINS = [...PRODUCTION_ORIGINS, 'https://*.vercel.app', 'http://localhost:3000']

export const DESIRED_CORS_RULES: CorsRule[] = [
  {
    AllowedOrigins: UPLOAD_ORIGINS,
    AllowedMethods: ['PUT'],
    AllowedHeaders: ['*'],
    ExposeHeaders: ['ETag'],
    MaxAgeSeconds: 3600,
  },
  {
    AllowedOrigins: PRODUCTION_ORIGINS,
    AllowedMethods: ['GET', 'HEAD'],
    AllowedHeaders: ['*'],
    ExposeHeaders: ['ETag', 'Content-Length', 'Content-Type'],
    MaxAgeSeconds: 3600,
  },
]

type LooseRule = {
  ID?: string
  AllowedOrigins?: string[]
  AllowedMethods?: string[]
  AllowedHeaders?: string[]
  ExposeHeaders?: string[]
  MaxAgeSeconds?: number
}

/** Order- and case-insensitive form for comparison (B2 may reorder lists or add rule IDs). */
function canonical(rules: LooseRule[]): string {
  const sortLower = (xs: string[] | undefined) => [...(xs ?? [])].map((x) => x.toLowerCase()).sort()
  return JSON.stringify(
    rules
      .map((r) => ({
        o: sortLower(r.AllowedOrigins),
        m: sortLower(r.AllowedMethods),
        h: sortLower(r.AllowedHeaders),
        e: sortLower(r.ExposeHeaders),
        a: r.MaxAgeSeconds ?? 0,
      }))
      .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))
  )
}

export function sameCorsRules(a: LooseRule[], b: LooseRule[]): boolean {
  return canonical(a) === canonical(b)
}

/** The two S3 calls the apply step needs (S3Client in production, a fake in tests). */
export interface CorsClient {
  get(): Promise<LooseRule[] | null>
  put(rules: CorsRule[]): Promise<void>
}

export interface CorsApplyResult {
  before: LooseRule[] | null
  after: LooseRule[] | null
  /** false when the bucket already had exactly these rules (nothing written). */
  changed: boolean
}

export async function applyStorageCors(client: CorsClient, desired: CorsRule[] = DESIRED_CORS_RULES): Promise<CorsApplyResult> {
  const before = await client.get()
  if (before && sameCorsRules(before, desired)) return { before, after: before, changed: false }
  await client.put(desired)
  // Read back what the storage actually stored.
  const after = await client.get()
  return { before, after, changed: true }
}
