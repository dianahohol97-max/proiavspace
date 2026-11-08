/**
 * «Магічна збірка»: the whole album in one click. Pure and synchronous — the
 * heavy part (measuring frames) happens before, in the culling workers
 * (./analyze.ts); planning 800 frames takes tens of milliseconds.
 */
import { formatFor } from '../geometry'
import type { AlbumPhoto } from '../types'
import { buildSpreads, capacity, planChapters, shotScale, type Item } from './compose'
import { coverScore, magicCover, shootDate } from './cover'
import { focalPoint } from './focal'
import { scorePhotos, selectFrames } from './select'
import { chapterStarts, MINUTE, splitAt, storyOrder } from './story'
import { MAGIC_STYLES, type MagicInput, type MagicResult, type MagicStyle } from './types'

export { MAGIC_STYLES, type MagicInput, type MagicResult, type MagicStyle }
export { capacity } from './compose'

const defaultId = () => crypto.randomUUID()

export function buildMagicAlbum(input: MagicInput): MagicResult {
  const { spec, style, analysis, decisions = {}, bestOverrides = {} } = input
  const newId = input.newId ?? defaultId
  const hidden = input.photos.filter((p) => p.hidden)
  const rejected = input.photos.filter((p) => !p.hidden && decisions[p.id] === 'confirmed')
  const pool = input.photos.filter((p) => !p.hidden && decisions[p.id] !== 'confirmed')
  const spreadsWanted = Math.max(1, Math.min(Math.round(input.targetSpreads), pool.length || 1))

  // 1. Story: capture order, chapters at the shoot's own pauses.
  const story = storyOrder(pool)
  const minSize = Math.max(2, Math.floor(pool.length / (spreadsWanted * 4)))
  const starts = story.values
    ? chapterStarts(story.values, {
        maxChapters: Math.max(1, Math.floor(spreadsWanted / 2)),
        minSize,
        minGap: story.order === 'time' ? 12 * MINUTE : 40,
        burstGap: story.order === 'time' ? 2000 : 0,
      })
    : []
  const chaptersAll = splitAt(story.photos, starts)

  // 2. Selection by the culling signals. The cover frame is chosen first and
  //    is not repeated inside (nor are its near-identical frames).
  const scores = scorePhotos(story.photos, analysis, decisions, bestOverrides)
  const byId = new Map(pool.map((p) => [p.id, p]))
  const item = (id: string): Item => {
    const photo = byId.get(id)!
    const a = analysis[id]
    return { photo, score: scores.get(id)!, analysis: a, focal: focalPoint(photo, a), scale: shotScale(a) }
  }
  const coverItems = pool.length > spreadsWanted ? story.photos.map((p) => item(p.id)) : []
  const best = coverItems.length ? coverItems.reduce((a, b) => (coverScore(b) > coverScore(a) ? b : a)) : null
  const need = capacity(style, spreadsWanted).photos
  const chosenIds = selectFrames(chaptersAll, scores, Math.max(need, spreadsWanted), best ? [best.photo.id] : [])
  const chapters = chosenIds.map((ids) => ids.map(item)).filter((c) => c.length)

  // 3. Rhythm and pairs.
  const format = formatFor(spec, 'spread')
  const plans = planChapters(chapters, spreadsWanted, style, format.widthMm / format.heightMm)
  const { spreads, heroes } = buildSpreads(plans, spec, style, newId)

  // 4. Cover: the best frame, title, date; spine for this many spreads.
  const chosen = chapters.flat()
  const times = pool.map((p) => p.takenAt).filter((t): t is number => t != null && Number.isFinite(t))
  const cover = magicCover(best, spec, spreads.length, input.title, shootDate(times), style, newId)

  return {
    spreads: [cover, ...spreads],
    chapters: chapters.map((c) => c.map((it) => it.photo.id)),
    report: {
      style,
      pool: pool.length,
      hidden: hidden.length,
      rejected: rejected.length,
      chosen: chosen.length,
      clientPicks: chosen.filter((it) => it.score.clientPick).length,
      chapters: chapters.length,
      heroes,
      spreads: spreads.length,
      focalFromFaces: chosen.filter((it) => it.focal.source === 'faces').length,
      focalFromSubject: chosen.filter((it) => it.focal.source === 'subject').length,
      order: story.order,
    },
  }
}

/** All three styles from the same analysis (one click → three variants). */
export function buildMagicVariants(input: Omit<MagicInput, 'style'>): MagicResult[] {
  return MAGIC_STYLES.map((s) => buildMagicAlbum({ ...input, style: s.id }))
}

export type { AlbumPhoto }
