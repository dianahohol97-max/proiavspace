'use client'

/**
 * Album document state: spreads with undo/redo history and debounced
 * autosave. Saving compares each spread with what was last saved, sends only
 * the changed ones (album_save_spread replaces a spread atomically), then
 * syncs order/deletions — so undo needs no special casing: whatever the
 * document looks like after an undo simply gets saved.
 */
import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import type { AlbumBackend } from '@/lib/album/backend'
import type { AlbumSpread } from '@/lib/album/types'

const HISTORY_LIMIT = 150
export const AUTOSAVE_DELAY_MS = 700

interface State {
  spreads: AlbumSpread[]
  past: { spreads: AlbumSpread[]; key: string | null }[]
  future: AlbumSpread[][]
  /** Key of the last committed change; equal keys merge (one slider drag = one undo step). */
  lastKey: string | null
}

type Action =
  | { type: 'commit'; update: (spreads: AlbumSpread[]) => AlbumSpread[]; key?: string }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'reset'; spreads: AlbumSpread[] }

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'commit': {
      const next = action.update(state.spreads)
      if (next === state.spreads) return state
      const key = action.key ?? null
      const merge = key !== null && key === state.lastKey
      return {
        spreads: next,
        past: merge ? state.past : [...state.past, { spreads: state.spreads, key }].slice(-HISTORY_LIMIT),
        future: [],
        lastKey: key,
      }
    }
    case 'undo': {
      const prev = state.past[state.past.length - 1]
      if (!prev) return state
      return { spreads: prev.spreads, past: state.past.slice(0, -1), future: [state.spreads, ...state.future], lastKey: null }
    }
    case 'redo': {
      const [next, ...rest] = state.future
      if (!next) return state
      return { spreads: next, past: [...state.past, { spreads: state.spreads, key: null }], future: rest, lastKey: null }
    }
    case 'reset':
      return { spreads: action.spreads, past: [], future: [], lastKey: null }
  }
}

export type SaveStatus = 'saved' | 'pending' | 'saving' | 'error'

export function useAlbumDoc(
  backend: AlbumBackend,
  projectId: string,
  stored: AlbumSpread[],
  /** Applied after every change (e.g. re-fit the cover to the spine). Must return the same array when nothing changes. */
  normalize: (spreads: AlbumSpread[]) => AlbumSpread[] = (s) => s
) {
  const initial = stored
  const [state, dispatch] = useReducer(reducer, { spreads: normalize(stored), past: [], future: [], lastKey: null })
  const [status, setStatus] = useState<SaveStatus>('saved')
  const [error, setError] = useState<string | null>(null)
  const saved = useRef<{ byId: Map<string, string>; order: string }>({
    byId: new Map(initial.map((s) => [s.id, JSON.stringify(s)])),
    order: initial.map((s) => s.id).join(','),
  })
  const latest = useRef(state.spreads)
  latest.current = state.spreads
  const inFlight = useRef<Promise<void> | null>(null)
  const again = useRef(false)

  const isDirty = useCallback((spreads: AlbumSpread[]) => {
    if (spreads.map((s) => s.id).join(',') !== saved.current.order) return true
    return spreads.some((s) => saved.current.byId.get(s.id) !== JSON.stringify(s))
  }, [])

  const saveNow = useCallback(async (): Promise<void> => {
    if (inFlight.current) {
      again.current = true
      return inFlight.current
    }
    const run = async () => {
      const spreads = latest.current
      if (!isDirty(spreads)) {
        setStatus('saved')
        return
      }
      setStatus('saving')
      try {
        for (let i = 0; i < spreads.length; i++) {
          const s = spreads[i]!
          const json = JSON.stringify(s)
          if (saved.current.byId.get(s.id) === json) continue
          await backend.saveSpread(projectId, s, i)
          saved.current.byId.set(s.id, json)
        }
        const order = spreads.map((s) => s.id).join(',')
        if (order !== saved.current.order) {
          await backend.syncSpreads(projectId, spreads.map((s) => s.id))
          saved.current.order = order
          const keep = new Set(spreads.map((s) => s.id))
          for (const id of [...saved.current.byId.keys()]) if (!keep.has(id)) saved.current.byId.delete(id)
        }
        setError(null)
        setStatus(isDirty(latest.current) ? 'pending' : 'saved')
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Не вдалося зберегти')
        setStatus('error')
      }
    }
    inFlight.current = run().finally(() => {
      inFlight.current = null
    })
    await inFlight.current
    if (again.current) {
      again.current = false
      await saveNow()
    }
  }, [backend, projectId, isDirty])

  // Debounced autosave on every change.
  useEffect(() => {
    if (!isDirty(state.spreads)) return
    setStatus((s) => (s === 'saving' ? s : 'pending'))
    const timer = setTimeout(() => void saveNow(), AUTOSAVE_DELAY_MS)
    return () => clearTimeout(timer)
  }, [state.spreads, isDirty, saveNow])

  // Unsaved changes: warn before closing the tab.
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty(latest.current)) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [isDirty])

  const normalizeRef = useRef(normalize)
  normalizeRef.current = normalize
  const commit = useCallback(
    (update: (spreads: AlbumSpread[]) => AlbumSpread[], key?: string) =>
      dispatch({
        type: 'commit',
        update: (spreads) => {
          const next = update(spreads)
          return next === spreads ? spreads : normalizeRef.current(next)
        },
        key,
      }),
    []
  )
  const undo = useCallback(() => dispatch({ type: 'undo' }), [])
  const redo = useCallback(() => dispatch({ type: 'redo' }), [])

  return {
    spreads: state.spreads,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
    commit,
    undo,
    redo,
    status,
    error,
    saveNow,
  }
}

/** Replace one spread by id. */
export function mapSpread(spreads: AlbumSpread[], id: string, fn: (s: AlbumSpread) => AlbumSpread): AlbumSpread[] {
  let changed = false
  const next = spreads.map((s) => {
    if (s.id !== id) return s
    const out = fn(s)
    if (out !== s) changed = true
    return out
  })
  return changed ? next : spreads
}
