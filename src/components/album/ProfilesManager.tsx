'use client'

/**
 * Print profiles: the photographer's own (editable) and built-in examples to
 * copy. The form edits a PAGE size (how albums are named: «30×30»); the
 * stored spread width is twice the page.
 */
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { backendFor } from '@/lib/album/backend'
import { EXAMPLE_PROFILES, describeSpec, normalizeSpec } from '@/lib/album/profiles'
import { formatFor, sheetSizePx } from '@/lib/album/geometry'
import type { PrintProfile, PrintSpec } from '@/lib/album/types'
import { btn, btnGhost, btnPrimary, card, input, label } from './ui'

interface FormState {
  id?: string
  name: string
  pageW: string
  pageH: string
  bleed: string
  safe: string
  margin: string
  gap: string
  dpi: string
  color: 'srgb' | 'adobe_rgb'
  coverOn: boolean
  coverW: string
  coverH: string
  coverBleed: string
  spine: string
  spineStep: string
}

const s = (n: number) => String(n)

function toForm(name: string, spec: PrintSpec, id?: string): FormState {
  return {
    id,
    name,
    pageW: s(spec.spreadWidthMm / 2),
    pageH: s(spec.spreadHeightMm),
    bleed: s(spec.bleedMm),
    safe: s(spec.safeMm),
    margin: s(spec.marginMm),
    gap: s(spec.gapMm),
    dpi: s(spec.dpi),
    color: spec.colorProfile,
    coverOn: !!spec.cover,
    coverW: s(spec.cover?.widthMm ?? spec.spreadWidthMm + 10),
    coverH: s(spec.cover?.heightMm ?? spec.spreadHeightMm),
    coverBleed: s(spec.cover?.bleedMm ?? 15),
    spine: s(spec.cover?.spineMm ?? 10),
    spineStep: s(spec.cover?.spinePerSpreadMm ?? 0),
  }
}

function fromForm(f: FormState): PrintSpec {
  const n = (v: string) => Number(v.replace(',', '.'))
  return normalizeSpec({
    spreadWidthMm: n(f.pageW) * 2,
    spreadHeightMm: f.pageH,
    bleedMm: f.bleed,
    safeMm: f.safe,
    marginMm: f.margin,
    gapMm: f.gap,
    dpi: f.dpi,
    colorProfile: f.color,
    cover: f.coverOn ? { widthMm: f.coverW, heightMm: f.coverH, bleedMm: f.coverBleed, spineMm: f.spine, spinePerSpreadMm: f.spineStep } : null,
  })
}

function Field({ id, text, value, onChange, suffix }: { id: string; text: string; value: string; onChange(v: string): void; suffix?: string }) {
  return (
    <label className="flex flex-col gap-1" htmlFor={id}>
      <span className={label}>{text}</span>
      <span className="flex items-center gap-1.5">
        <input id={id} inputMode="decimal" className={input} value={value} onChange={(e) => onChange(e.target.value)} />
        {suffix && <span className="text-xs text-muted">{suffix}</span>}
      </span>
    </label>
  )
}

export function ProfilesManager({ backendKind, basePath }: { backendKind: 'server' | 'local'; basePath: string }) {
  const backend = backendFor(backendKind)
  const [profiles, setProfiles] = useState<PrintProfile[] | null>(null)
  const [form, setForm] = useState<FormState | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    backend.listProfiles().then(setProfiles, (e: Error) => setError(e.message))
  }, [backend])

  const set = (patch: Partial<FormState>) => setForm((f) => (f ? { ...f, ...patch } : f))

  let preview: string | null = null
  let formError: string | null = null
  if (form) {
    try {
      const spec = fromForm(form)
      const px = sheetSizePx(formatFor(spec, 'spread'), spec.dpi)
      preview = `Розворот ${spec.spreadWidthMm}×${spec.spreadHeightMm} мм → файл ${px.width}×${px.height} px з вильотом`
      if (spec.cover?.spinePerSpreadMm) {
        const at = (n: number) => Math.round((spec.cover!.spineMm + spec.cover!.spinePerSpreadMm! * n) * 10) / 10
        preview += ` · корінець: 10 розворотів — ${at(10)} мм, 20 — ${at(20)} мм`
      }
    } catch (e) {
      formError = (e as Error).message
    }
  }

  const save = async () => {
    if (!form) return
    setBusy(true)
    setError(null)
    try {
      const saved = await backend.saveProfile({ id: form.id, name: form.name, spec: fromForm(form) })
      setProfiles((all) => {
        const list = all ?? []
        return list.some((p) => p.id === saved.id) ? list.map((p) => (p.id === saved.id ? saved : p)) : [...list, saved]
      })
      setForm(null)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const remove = async (p: PrintProfile) => {
    if (!window.confirm(`Видалити профіль «${p.name}»? Уже створені альбоми не зміняться.`)) return
    try {
      await backend.deleteProfile(p.id)
      setProfiles((all) => (all ?? []).filter((x) => x.id !== p.id))
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <Link href={basePath} className="text-sm text-muted hover:text-fg">
        ← Альбоми
      </Link>
      <h1 className="mt-4 font-display text-4xl">Профілі друку</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted">
        Налаштування вашої друкарні: формат, виліт, безпечне поле, роздільна здатність, колірний профіль, окремий формат обкладинки. Профіль копіюється в
        альбом при створенні — зміни тут не зсувають уже зверстані альбоми.
      </p>
      {error && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-800" role="alert">{error}</p>}

      {form && (
        <div className={`${card} mt-6`} data-testid="profile-form">
          <h2 className="font-display text-2xl">{form.id ? 'Редагувати профіль' : 'Новий профіль'}</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 sm:col-span-2" htmlFor="pf-name">
              <span className={label}>Назва</span>
              <input id="pf-name" className={input} value={form.name} onChange={(e) => set({ name: e.target.value })} />
            </label>
            <Field id="pf-w" text="Ширина сторінки" suffix="мм" value={form.pageW} onChange={(v) => set({ pageW: v })} />
            <Field id="pf-h" text="Висота сторінки" suffix="мм" value={form.pageH} onChange={(v) => set({ pageH: v })} />
            <Field id="pf-bleed" text="Виліт (bleed)" suffix="мм" value={form.bleed} onChange={(v) => set({ bleed: v })} />
            <Field id="pf-safe" text="Безпечне поле" suffix="мм" value={form.safe} onChange={(v) => set({ safe: v })} />
            <Field id="pf-margin" text="Поля шаблонів" suffix="мм" value={form.margin} onChange={(v) => set({ margin: v })} />
            <Field id="pf-gap" text="Відступ між фото" suffix="мм" value={form.gap} onChange={(v) => set({ gap: v })} />
            <Field id="pf-dpi" text="Роздільна здатність" suffix="DPI" value={form.dpi} onChange={(v) => set({ dpi: v })} />
            <label className="flex flex-col gap-1" htmlFor="pf-color">
              <span className={label}>Колірний профіль</span>
              <select id="pf-color" className={input} value={form.color} onChange={(e) => set({ color: e.target.value as FormState['color'] })}>
                <option value="srgb">sRGB</option>
                <option value="adobe_rgb">Adobe RGB (1998)</option>
              </select>
            </label>
          </div>
          <label className="mt-5 flex items-center gap-2 text-sm font-semibold">
            <input type="checkbox" checked={form.coverOn} onChange={(e) => set({ coverOn: e.target.checked })} />
            Обкладинка окремим форматом (розгортка з корінцем)
          </label>
          {form.coverOn && (
            <div className="mt-3 grid gap-3 sm:grid-cols-5">
              <Field id="pf-cw" text="Ширина розгортки" suffix="мм" value={form.coverW} onChange={(v) => set({ coverW: v })} />
              <Field id="pf-ch" text="Висота" suffix="мм" value={form.coverH} onChange={(v) => set({ coverH: v })} />
              <Field id="pf-cb" text="Виліт / загин" suffix="мм" value={form.coverBleed} onChange={(v) => set({ coverBleed: v })} />
              <Field id="pf-spine" text="Корінець (база)" suffix="мм" value={form.spine} onChange={(v) => set({ spine: v })} />
              <Field id="pf-spine-step" text="+ на розворот" suffix="мм" value={form.spineStep} onChange={(v) => set({ spineStep: v })} />
            </div>
          )}
          <p className={`mt-4 text-xs ${formError ? 'text-red-700' : 'text-muted'}`} data-testid="profile-preview">
            {formError ?? preview}
          </p>
          <div className="mt-4 flex gap-2">
            <button className={btnPrimary} onClick={save} disabled={busy || !!formError || !form.name.trim()}>
              Зберегти профіль
            </button>
            <button className={btn} onClick={() => setForm(null)}>
              Скасувати
            </button>
          </div>
        </div>
      )}

      <section className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl">Мої профілі</h2>
          {!form && (
            <button className={btn} onClick={() => setForm(toForm('', EXAMPLE_PROFILES[0]!.spec))}>
              + Новий профіль
            </button>
          )}
        </div>
        {profiles === null ? (
          <p className="mt-3 text-sm text-muted">Завантажую…</p>
        ) : profiles.length === 0 ? (
          <p className="mt-3 text-sm text-muted">Своїх профілів ще немає — скопіюйте приклад нижче і змініть під свою друкарню.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2" data-testid="own-profiles">
            {profiles.map((p) => (
              <li key={p.id} className={`${card} flex items-center gap-3 !py-3`}>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{p.name}</p>
                  <p className="text-xs text-muted">{describeSpec(p.spec)}{p.spec.cover ? ' · окрема обкладинка' : ''}</p>
                </div>
                <button className={btnGhost} onClick={() => setForm(toForm(p.name, p.spec, p.id))}>
                  Змінити
                </button>
                <button className={btnGhost} onClick={() => setForm(toForm(`${p.name} (копія)`, p.spec))}>
                  Копія
                </button>
                <button className={btnGhost} onClick={() => remove(p)} aria-label={`Видалити ${p.name}`}>
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-8">
        <h2 className="font-display text-2xl">Приклади</h2>
        <ul className="mt-3 flex flex-col gap-2">
          {EXAMPLE_PROFILES.map((p) => (
            <li key={p.id} className={`${card} flex items-center gap-3 !py-3`}>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{p.name}</p>
                <p className="text-xs text-muted">{describeSpec(p.spec)}{p.spec.cover ? ' · окрема обкладинка' : ''}</p>
              </div>
              <button className={btn} onClick={() => setForm(toForm(p.name.replace(/^Приклад: /, ''), p.spec))}>
                Скопіювати й змінити
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
