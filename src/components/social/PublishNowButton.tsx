'use client'

import { useFormStatus } from 'react-dom'

/** Submit button that locks itself while the publish action runs — the silent
 *  version let a triple-click send the same post to Instagram three times. */
export function PublishNowButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-full bg-accent px-6 py-2.5 text-sm font-bold text-white disabled:opacity-60"
    >
      {pending ? 'Публікую…' : 'Опублікувати зараз'}
    </button>
  )
}
