import type { PhotoAnalysis } from '@/lib/culling/types'
import type { FileKind } from './raw/extract'
import type { ItemMeta } from './types'

export interface ProcessRequest {
  type: 'process'
  jobId: number
  file: File
  name: string
  kind: FileKind
}

export interface ProcessResponse {
  type: 'done'
  jobId: number
  ok: boolean
  meta?: ItemMeta
  analysis?: PhotoAnalysis
  thumb?: Blob
  error?: string
}
