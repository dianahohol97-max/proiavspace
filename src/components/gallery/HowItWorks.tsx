import type { HelpBlock } from '@/lib/gallery/help'

/**
 * A collapsed «Як це працює» note next to a gallery feature in the dashboard.
 * Plain <details>: no JavaScript, works before hydration.
 */
export function HowItWorks({ help, testId }: { help: HelpBlock; testId?: string }) {
  return (
    <details
      className="mt-4 max-w-2xl rounded-xl border border-line px-4 py-3 text-sm leading-relaxed"
      data-testid={testId}
    >
      <summary className="cursor-pointer font-semibold text-fg">{help.title}</summary>
      <ul className="mt-3 flex list-disc flex-col gap-2 pl-5 text-muted">
        {help.items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </details>
  )
}
