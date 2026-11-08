'use client'

/**
 * Chrome/Android's «install app» prompt (beforeinstallprompt). The event can
 * fire before any React component mounts, so it is captured here at module
 * load (AppShell imports this module on every dashboard page).
 */
export interface InstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let deferred: InstallPromptEvent | null = null
const listeners = new Set<(event: InstallPromptEvent | null) => void>()

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault()
    deferred = event as InstallPromptEvent
    listeners.forEach((listener) => listener(deferred))
  })
  window.addEventListener('appinstalled', () => {
    deferred = null
    listeners.forEach((listener) => listener(null))
  })
}

export function onInstallPrompt(listener: (event: InstallPromptEvent | null) => void): () => void {
  listeners.add(listener)
  listener(deferred)
  return () => {
    listeners.delete(listener)
  }
}

/** Shows the browser's install dialog; true when the photographer accepted. */
export async function promptInstall(): Promise<boolean> {
  const event = deferred
  if (!event) return false
  deferred = null
  await event.prompt()
  const choice = await event.userChoice.catch(() => ({ outcome: 'dismissed' as const }))
  listeners.forEach((listener) => listener(null))
  return choice.outcome === 'accepted'
}
