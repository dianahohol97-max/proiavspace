/**
 * «Магічна збірка» — the whole album in one click, on top of the autodesign:
 * AI culling signals pick the frames, capture time tells the story, heroes
 * and complementary pairs give the rhythm, faces give the crop. Pure data
 * shapes, shared by the planner (node tests) and the editor.
 */
import type { Decision, PhotoAnalysis } from '@/lib/culling/types'
import type { IdFactory } from '../autofill'
import type { AlbumPhoto, AlbumSpread, PrintSpec } from '../types'

export type MagicStyle = 'calm' | 'rich' | 'editorial'

export const MAGIC_STYLES: { id: MagicStyle; name: string; hint: string }[] = [
  { id: 'calm', name: 'Спокійний', hint: '1–3 кадри на розворот, поля, багато повітря, гармонія кольору' },
  { id: 'rich', name: 'Насичений', hint: '3–6 кадрів, сітки й кадри під обріз, більше історії на розворот' },
  { id: 'editorial', name: 'Редакційний', hint: 'асиметрія: велике + дрібні, контрастні пари, як у журналі' },
]

export interface MagicInput {
  /** The pool: the whole gallery or the photos picked in the strip. Any order. */
  photos: AlbumPhoto[]
  /** Culling measurements (sharpness, dHash, faces, palette, subject) by photo id. */
  analysis: Record<string, PhotoAnalysis | undefined>
  spec: PrintSpec
  /** Inner spreads, the cover not counted. */
  targetSpreads: number
  style: MagicStyle
  /** Gallery title for the cover. */
  title: string
  /** Photographer's culling decisions: 'confirmed' rejects never go in; 'cleared' frames lose their flags. */
  decisions?: Record<string, Decision>
  /** Photographer-chosen best frame per series. */
  bestOverrides?: Record<string, string>
  newId?: IdFactory
}

export interface MagicReport {
  style: MagicStyle
  /** Photos in the pool / hidden from the client / rejected / chosen. */
  pool: number
  hidden: number
  rejected: number
  chosen: number
  /** Chosen frames the client hearted or sent to retouch. */
  clientPicks: number
  chapters: number
  heroes: number
  spreads: number
  /** Frames whose focal point came from faces / the crisp subject. */
  focalFromFaces: number
  focalFromSubject: number
  /** How the story was ordered. */
  order: 'time' | 'name'
}

export interface MagicResult {
  /** Cover first, then the inner spreads. */
  spreads: AlbumSpread[]
  report: MagicReport
  /** Chosen photo ids per chapter, story order (tests, diagnostics). */
  chapters: string[][]
}
