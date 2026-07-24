import Link from 'next/link'
import type { Block } from '@/lib/blog/articles'

/**
 * Renders an article's structured blocks into editorial prose: a larger lead
 * paragraph, headings with a brand voice, hanging-dash lists, and the closing
 * call-to-action as a designed card rather than a bare button.
 */
export function ArticleBody({ blocks, locale }: { blocks: Block[]; locale: string }) {
  // The first paragraph becomes the standfirst (lead) for editorial rhythm.
  let leadUsed = false

  return (
    <div className="mt-10">
      {blocks.map((block, index) => {
        if (block.type === 'h2') {
          return (
            <h2
              key={index}
              className="mt-12 mb-4 font-brand text-2xl leading-snug tracking-tight text-fg sm:text-[1.6rem]"
            >
              {block.text}
            </h2>
          )
        }

        if (block.type === 'ul') {
          return (
            <ul key={index} className="my-6 flex flex-col gap-3">
              {block.items.map((item, i) => (
                <li key={i} className="flex gap-3 text-[1.05rem] leading-8 text-[#2a2824]">
                  <span aria-hidden className="mt-3 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          )
        }

        if (block.type === 'cta') {
          const href = block.href.startsWith('/')
            ? `/${locale}${block.href.replace(/^\/[a-z]{2}(?=\/|$)/, '')}`
            : block.href
          return (
            <div
              key={index}
              className="my-10 flex flex-col items-start gap-4 rounded-2xl border border-[#d5ddff] bg-[#eef1ff] p-7 sm:flex-row sm:items-center sm:justify-between"
            >
              <p className="font-brand text-lg leading-snug text-fg">
                {locale === 'en'
                  ? 'Bring this to life with proiav'
                  : 'Зробіть це з проЯв — під вашим брендом'}
              </p>
              <Link
                href={href}
                className="shrink-0 rounded-full bg-accent px-7 py-3 text-sm font-bold text-white no-underline transition-colors hover:bg-accent-deep"
              >
                {block.text}
              </Link>
            </div>
          )
        }

        // paragraph — first one is the lead
        const isLead = !leadUsed
        leadUsed = true
        return (
          <p
            key={index}
            className={
              isLead
                ? 'mb-6 text-xl leading-9 text-fg'
                : 'mb-6 text-[1.075rem] leading-8 text-[#2a2824]'
            }
          >
            {block.text}
          </p>
        )
      })}
    </div>
  )
}
