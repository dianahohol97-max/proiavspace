'use client'

import { useEffect, useRef } from 'react'
import { useFormState, useFormStatus } from 'react-dom'
import { useRouter } from 'next/navigation'
import type { FormState } from '@/lib/actions/galleries'

type StateAction = (prev: FormState, formData: FormData) => Promise<FormState>

const input =
  'min-h-[44px] w-full rounded-xl border border-line bg-white px-3 py-2 text-[16px] outline-none transition-colors focus:border-fg sm:text-sm'
const label = 'text-sm font-bold text-fg'

function SubmitButton({ idle, busy }: { idle: string; busy: string }) {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="min-h-[44px] self-start rounded-full bg-fg px-6 text-sm font-bold text-bg transition-opacity disabled:opacity-60"
    >
      {pending ? busy : idle}
    </button>
  )
}

/** «Збережено ✓» / a plain-words error under the button. */
function FormFeedback({ state, saved, errors }: { state: FormState; saved: string; errors: Record<string, string> }) {
  if (state.status === 'saved') {
    return (
      <p role="status" className="text-sm font-bold text-emerald-700">
        {saved}
      </p>
    )
  }
  if (state.status === 'error') {
    return (
      <p role="alert" className="text-sm font-semibold text-red-700">
        {errors[state.error ?? ''] ?? errors.failed}
      </p>
    )
  }
  return null
}

function useRefreshOnSave(state: FormState) {
  const router = useRouter()
  const seen = useRef(state.at)
  useEffect(() => {
    if (state.status === 'saved' && state.at !== seen.current) {
      seen.current = state.at
      router.refresh()
    }
  }, [state, router])
}

export interface DetailsLabels {
  title: string
  titleLabel: string
  dateLabel: string
  descriptionLabel: string
  save: string
  saving: string
  saved: string
  saveError: string
  titleRequired: string
}

/** «Назва й дата» (Design tab): the name, shoot date and the client-facing description. */
export function GalleryDetailsForm({
  action,
  initial,
  labels,
}: {
  action: StateAction
  initial: { title: string; eventDate: string; description: string }
  labels: DetailsLabels
}) {
  const [state, formAction] = useFormState(action, { status: 'idle' } as FormState)
  useRefreshOnSave(state)
  return (
    <form action={formAction} className="flex flex-col gap-4 rounded-2xl border border-line bg-white p-5 sm:p-6" data-testid="details-form">
      <h3 className="font-brand text-lg">{labels.title}</h3>
      <div className="grid gap-4 sm:grid-cols-[1fr_12rem]">
        <div className="flex flex-col gap-1.5">
          <label className={label} htmlFor="d-title">
            {labels.titleLabel}
          </label>
          <input id="d-title" name="title" required maxLength={200} defaultValue={initial.title} className={input} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className={label} htmlFor="d-date">
            {labels.dateLabel}
          </label>
          <input id="d-date" name="event_date" type="date" defaultValue={initial.eventDate} className={input} />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <label className={label} htmlFor="d-description">
          {labels.descriptionLabel}
        </label>
        <textarea id="d-description" name="description" rows={2} maxLength={2000} defaultValue={initial.description} className={input} />
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <SubmitButton idle={labels.save} busy={labels.saving} />
        <FormFeedback state={state} saved={labels.saved} errors={{ title: labels.titleRequired, failed: labels.saveError }} />
      </div>
    </form>
  )
}

export interface AccessLabels {
  passwordLabel: string
  passwordSet: string
  passwordNone: string
  passwordHint: string
  passwordRemove: string
  expiryLabel: string
  expiryHint: string
  save: string
  saving: string
  saved: string
  saveError: string
}

/** «Доступ»: password and the date access ends. */
export function GalleryAccessForm({
  action,
  hasPassword,
  expiry,
  labels,
}: {
  action: StateAction
  hasPassword: boolean
  expiry: string
  labels: AccessLabels
}) {
  const [state, formAction] = useFormState(action, { status: 'idle' } as FormState)
  useRefreshOnSave(state)
  const formRef = useRef<HTMLFormElement>(null)
  // A saved password must not linger in the field.
  useEffect(() => {
    if (state.status === 'saved') {
      const field = formRef.current?.elements.namedItem('password') as HTMLInputElement | null
      if (field) field.value = ''
    }
  }, [state])
  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-5" data-testid="access-form">
      <div className="flex flex-col gap-1.5">
        <label className={label} htmlFor="g-password">
          {labels.passwordLabel} {hasPassword && <span aria-hidden>🔒</span>}
        </label>
        {/* Password-manager opt-outs: extensions inject icons INTO password
            fields, mutating React-managed DOM and crashing hydration. This is a
            gallery-access password, not a login — nothing to manage. */}
        <input
          id="g-password"
          name="password"
          type="password"
          autoComplete="new-password"
          data-1p-ignore="true"
          data-lpignore="true"
          data-bwignore="true"
          data-protonpass-ignore="true"
          data-form-type="other"
          placeholder={hasPassword ? labels.passwordSet : labels.passwordNone}
          className={input}
        />
        <p className="text-xs leading-relaxed text-muted">{labels.passwordHint}</p>
        {hasPassword && (
          <label className="mt-1 flex min-h-[44px] items-center gap-3 text-sm">
            <input type="checkbox" name="remove_password" className="h-5 w-5" />
            {labels.passwordRemove}
          </label>
        )}
      </div>
      <div className="flex flex-col gap-1.5">
        <label className={label} htmlFor="g-expires">
          {labels.expiryLabel}
        </label>
        <input id="g-expires" name="expires_at" type="date" defaultValue={expiry} className={`${input} sm:max-w-[14rem]`} />
        <p className="text-xs leading-relaxed text-muted">{labels.expiryHint}</p>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <SubmitButton idle={labels.save} busy={labels.saving} />
        <FormFeedback state={state} saved={labels.saved} errors={{ failed: labels.saveError }} />
      </div>
    </form>
  )
}

/** Delete with a native confirmation naming the gallery — no accidental clicks. */
export function DeleteGalleryButton({ action, label, confirmText }: { action: () => Promise<void>; label: string; confirmText: string }) {
  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (!window.confirm(confirmText)) event.preventDefault()
      }}
    >
      <button
        type="submit"
        className="min-h-[44px] rounded-full border border-red-600/40 px-5 text-sm font-bold text-red-700 transition-colors hover:bg-red-600 hover:text-white"
      >
        {label}
      </button>
    </form>
  )
}

export interface NewGalleryLabels {
  titleLabel: string
  titlePlaceholder: string
  eventDateLabel: string
  eventDateHint: string
  create: string
  creating: string
  errorTitle: string
  errorGeneric: string
}

/** «Нова галерея»: name + shoot date, then straight to uploading. */
export function NewGalleryForm({ action, labels }: { action: StateAction; labels: NewGalleryLabels }) {
  const [state, formAction] = useFormState(action, { status: 'idle' } as FormState)
  return (
    <form action={formAction} className="flex flex-col gap-5" data-testid="new-gallery-form" noValidate>
      <div className="flex flex-col gap-1.5">
        <label className={label} htmlFor="title">
          {labels.titleLabel}
        </label>
        <input
          id="title"
          name="title"
          required
          autoFocus
          maxLength={200}
          autoComplete="off"
          placeholder={labels.titlePlaceholder}
          aria-invalid={state.status === 'error' && state.error === 'title'}
          className={`${input} text-base`}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className={label} htmlFor="event_date">
          {labels.eventDateLabel}
        </label>
        <input id="event_date" name="event_date" type="date" className={`${input} sm:max-w-[14rem]`} />
        <p className="text-xs text-muted">{labels.eventDateHint}</p>
      </div>
      <FormFeedback state={state} saved="" errors={{ title: labels.errorTitle, failed: labels.errorGeneric }} />
      <SubmitButtonWide idle={labels.create} busy={labels.creating} />
    </form>
  )
}

function SubmitButtonWide({ idle, busy }: { idle: string; busy: string }) {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="min-h-[52px] w-full rounded-full bg-accent px-8 text-base font-bold text-white transition-colors hover:bg-accent-deep disabled:opacity-60 sm:w-auto sm:self-start"
    >
      {pending ? busy : `${idle} →`}
    </button>
  )
}
