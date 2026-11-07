'use client'

/**
 * Album projects: the list and «Новий альбом» (from a proYav gallery, or empty
 * with uploads), with a print profile — own or a built-in example.
 */
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { backendFor, type GalleryOption } from '@/lib/album/backend'
import { EXAMPLE_PROFILES, describeSpec } from '@/lib/album/profiles'
import { MAGIC_STYLES, type MagicStyle } from '@/lib/album/magic/types'
import type { AlbumProjectSummary, PrintProfile } from '@/lib/album/types'
import { btn, btnGhost, btnPrimary, card, input, label } from './ui'

export function AlbumsHome({ backendKind, basePath, editorPath }: { backendKind: 'server' | 'local'; basePath: string; editorPath: string }) {
  const backend = backendFor(backendKind)
  const router = useRouter()
  const [projects, setProjects] = useState<AlbumProjectSummary[] | null>(null)
  const [profiles, setProfiles] = useState<PrintProfile[]>([])
  const [galleries, setGalleries] = useState<GalleryOption[]>([])
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [busy, setBusy] = useState(false)
  const [title, setTitle] = useState('')
  const [profileId, setProfileId] = useState('')
  const [source, setSource] = useState<'gallery' | 'empty'>('gallery')
  const [galleryId, setGalleryId] = useState('')
  const [auto, setAuto] = useState(true)
  const [how, setHow] = useState<'magic' | 'all'>('magic')
  const [magicSpreads, setMagicSpreads] = useState(20)
  const [magicStyle, setMagicStyle] = useState<MagicStyle>('editorial')

  useEffect(() => {
    Promise.all([backend.listProjects(), backend.listProfiles(), backend.listGalleries()]).then(
      ([p, pr, g]) => {
        setProjects(p)
        setProfiles(pr)
        setGalleries(g)
        setProfileId(pr[0]?.id ?? EXAMPLE_PROFILES[0]!.id)
        setGalleryId(g.find((x) => x.photoCount > 0)?.id ?? g[0]?.id ?? '')
      },
      (e: Error) => setError(e.message)
    )
  }, [backend])

  const allProfiles = [...profiles, ...EXAMPLE_PROFILES]
  const chosenProfile = allProfiles.find((p) => p.id === profileId)

  const create = async () => {
    if (!chosenProfile) return
    setBusy(true)
    setError(null)
    try {
      const fromGallery = source === 'gallery' && galleryId
      const { id } = await backend.createProject({
        title,
        spec: chosenProfile.spec,
        profileId: chosenProfile.example ? null : chosenProfile.id,
        galleryId: fromGallery ? galleryId : null,
      })
      const query = !fromGallery || !auto ? '' : how === 'magic' ? `?magic=1&spreads=${magicSpreads}&style=${magicStyle}` : '?auto=1'
      router.push(`${editorPath}/${id}${query}`)
    } catch (e) {
      setError((e as Error).message)
      setBusy(false)
    }
  }

  const remove = async (p: AlbumProjectSummary) => {
    if (!window.confirm(`Видалити альбом «${p.title}»? Фото в галереї залишаться.`)) return
    try {
      await backend.deleteProject(p.id)
      setProjects((all) => (all ?? []).filter((x) => x.id !== p.id))
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-4xl">Альбоми</h1>
          <p className="mt-2 max-w-xl text-sm text-muted">
            Верстка весільних і сімейних альбомів у браузері: розвороти з фото вашої галереї, шаблони, кадрування, експорт для друкарні (JPEG, PDF, PSD).
          </p>
        </div>
        <div className="flex gap-2">
          <Link href={`${basePath}/profiles`} className={btn}>
            Профілі друку
          </Link>
          {!creating && (
            <button className={btnPrimary} onClick={() => setCreating(true)}>
              + Новий альбом
            </button>
          )}
        </div>
      </div>

      {error && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-800" role="alert">{error}</p>}

      {creating && (
        <div className={`${card} mt-6`} data-testid="new-album">
          <h2 className="font-display text-2xl">Новий альбом</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1 sm:col-span-2" htmlFor="album-title">
              <span className={label}>Назва</span>
              <input id="album-title" className={input} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Весілля Ані й Тараса" />
            </label>
            <label className="flex flex-col gap-1 sm:col-span-2" htmlFor="album-profile">
              <span className={label}>Профіль друку</span>
              <select id="album-profile" className={input} value={profileId} onChange={(e) => setProfileId(e.target.value)}>
                {profiles.length > 0 && (
                  <optgroup label="Мої профілі">
                    {profiles.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </optgroup>
                )}
                <optgroup label="Приклади">
                  {EXAMPLE_PROFILES.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </optgroup>
              </select>
              {chosenProfile && <span className="text-xs text-muted">{describeSpec(chosenProfile.spec)}</span>}
            </label>
            <fieldset className="flex flex-col gap-2 sm:col-span-2">
              <legend className={label}>Фото</legend>
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" name="source" checked={source === 'gallery'} onChange={() => setSource('gallery')} disabled={!galleries.length} />
                З галереї проЯв
              </label>
              {source === 'gallery' && galleries.length > 0 && (
                <div className="ml-6 flex flex-col gap-2">
                  <select className={input} value={galleryId} onChange={(e) => setGalleryId(e.target.value)} aria-label="Галерея">
                    {galleries.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.title} · {g.photoCount} фото
                      </option>
                    ))}
                  </select>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} />
                    Одразу розкласти фото по розворотах (потім можна все змінити)
                  </label>
                  {auto && (
                    <div className="ml-6 flex flex-col gap-2" data-testid="new-album-how">
                      <label className="flex items-start gap-2 text-sm">
                        <input type="radio" name="how" className="mt-1" checked={how === 'magic'} onChange={() => setHow('magic')} />
                        <span>
                          ✨ Магічна збірка
                          <span className="block text-xs text-muted">Кращі кадри за AI-відбором, історія за часом зйомки, герої й пари, обкладинка; три стилі на вибір.</span>
                        </span>
                      </label>
                      {how === 'magic' && (
                        <div className="ml-6 flex flex-wrap items-center gap-2 text-sm">
                          <label className="flex items-center gap-1.5">
                            Розворотів
                            <input
                              type="number"
                              min={1}
                              max={80}
                              className={`${input} w-20`}
                              value={magicSpreads}
                              onChange={(e) => setMagicSpreads(Math.max(1, Math.min(80, Number(e.target.value) || 1)))}
                              aria-label="Розворотів"
                            />
                          </label>
                          <select className={`${input} w-auto`} value={magicStyle} onChange={(e) => setMagicStyle(e.target.value as MagicStyle)} aria-label="Стиль">
                            {MAGIC_STYLES.map((x) => (
                              <option key={x.id} value={x.id}>
                                {x.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                      <label className="flex items-center gap-2 text-sm">
                        <input type="radio" name="how" checked={how === 'all'} onChange={() => setHow('all')} />
                        Усі фото підряд (автодизайн)
                      </label>
                    </div>
                  )}
                </div>
              )}
              {backendKind === 'server' && (
                <label className="flex items-center gap-2 text-sm">
                  <input type="radio" name="source" checked={source === 'empty'} onChange={() => setSource('empty')} />
                  Порожній — завантажу фото в редакторі
                </label>
              )}
            </fieldset>
          </div>
          <div className="mt-5 flex gap-2">
            <button className={btnPrimary} onClick={create} disabled={busy || !title.trim() || (source === 'gallery' && !galleryId)}>
              Створити
            </button>
            <button className={btn} onClick={() => setCreating(false)}>
              Скасувати
            </button>
          </div>
        </div>
      )}

      <section className="mt-8">
        {projects === null ? (
          <p className="text-sm text-muted">Завантажую…</p>
        ) : projects.length === 0 ? (
          <p className="text-sm text-muted">Альбомів ще немає.</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2" data-testid="album-list">
            {projects.map((p) => (
              <li key={p.id} className={`${card} flex flex-col gap-1`}>
                <Link href={`${editorPath}/${p.id}`} className="font-display text-xl text-fg no-underline hover:underline">
                  {p.title}
                </Link>
                <p className="text-xs text-muted">{describeSpec(p.spec)}</p>
                <p className="text-xs text-muted">
                  Розворотів: {p.spreadCount} · змінено {new Date(p.updatedAt).toLocaleDateString('uk-UA')}
                </p>
                <div className="mt-2 flex gap-2">
                  <Link href={`${editorPath}/${p.id}`} className={btn}>
                    Відкрити
                  </Link>
                  <button className={btnGhost} onClick={() => remove(p)}>
                    Видалити
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
