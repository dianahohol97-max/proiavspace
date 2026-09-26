'use client'

import { useState } from 'react'

export function CopyLinkButton({
  url,
  label,
  copiedLabel,
}: {
  url: string
  label: string
  copiedLabel: string
}) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      // In-app browsers (Instagram, Telegram) may not expose the clipboard
      // API: fall back to a hidden selected textarea + execCommand.
      const area = document.createElement('textarea')
      area.value = url
      area.setAttribute('readonly', '')
      area.style.position = 'fixed'
      area.style.opacity = '0'
      document.body.appendChild(area)
      area.select()
      try {
        document.execCommand('copy')
      } finally {
        area.remove()
      }
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="border border-line px-6 py-2 text-sm uppercase tracking-widest text-muted transition-colors hover:border-fg hover:text-fg"
    >
      {copied ? copiedLabel : label}
    </button>
  )
}
