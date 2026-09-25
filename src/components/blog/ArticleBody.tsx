import Link from 'next/link'
import type { ReactNode } from 'react'
import type { Block } from '@/lib/blog/articles'

/**
 * Inline links inside article text: [anchor](/uk/path) or [anchor](https://…).
 * Articles are Ukrainian and canonical on /uk, so internal links keep their
 * /uk prefix as written.
 */
const LINK = /\[([^\]]+)\]\(([^)\s]+)\)/g

const SHOW_BRIEFS =
  process.env.NODE_ENV !== 'production' || process.env.NEXT_PUBLIC_SHOW_IMAGE_BRIEFS === '1'

/** Editorial marker for facts awaiting confirmation — rendered loud so it never ships unnoticed. */
const TODO = /(\[УТОЧНИТИ[^\]]*\])/

export function RichText({ text }: { text: string }) {
  if (TODO.test(text)) {
    return (
      <>
        {text.split(TODO).map((part, i) =>
          TODO.test(part) ? (
            <mark key={i} className="rounded bg-[#ffe3e0] px-1 font-semibold text-[#b3261e]">
              {part}
            </mark>
          ) : (
            <RichText key={i} text={part} />
          )
        )}
      </>
    )
  }
  const out: ReactNode[] = []
  let last = 0
  for (const match of text.matchAll(LINK)) {
    const [whole, anchor, href] = match
    const at = match.index ?? 0
    if (at > last) out.push(text.slice(last, at))
    out.push(
      href.startsWith('/') ? (
        <Link key={at} href={href} className="text-accent underline decoration-accent/40 underline-offset-4 hover:decoration-accent">
          {anchor}
        </Link>
      ) : (
        <a key={at} href={href} rel="noopener" className="text-accent underline decoration-accent/40 underline-offset-4 hover:decoration-accent">
          {anchor}
        </a>
      )
    )
    last = at + whole.length
  }
  if (last < text.length) out.push(text.slice(last))
  return <>{out}</>
}

/** Plain text of a string with inline links (for JSON-LD, meta). */
export function stripLinks(text: string): string {
  return text.replace(LINK, '$1')
}

/**
 * Renders an article's structured blocks into editorial prose: a larger lead
 * paragraph, headings with a brand voice, hanging-dash lists, tables, figures,
 * an FAQ, and the closing call-to-action as a designed card.
 */
export function ArticleBody({ blocks, locale }: { blocks: Block[]; locale: string }) {
  // The first paragraph becomes the standfirst (lead) for editorial rhythm.
  let leadUsed = false

  return (
    <div className="mt-10">
      {blocks.map((block, index) => {
        switch (block.type) {
          case 'h2':
            return (
              <h2
                key={index}
                className="mb-4 mt-12 font-brand text-2xl leading-snug tracking-tight text-fg sm:text-[1.6rem]"
              >
                {block.text}
              </h2>
            )

          case 'h3':
            return (
              <h3 key={index} className="mb-3 mt-8 font-brand text-lg leading-snug tracking-tight text-fg sm:text-xl">
                {block.text}
              </h3>
            )

          case 'ul':
            return (
              <ul key={index} className="my-6 flex flex-col gap-3">
                {block.items.map((item, i) => (
                  <li key={i} className="flex gap-3 text-[1.05rem] leading-8 text-[#2a2824]">
                    <span aria-hidden className="mt-3 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                    <span>
                      <RichText text={item} />
                    </span>
                  </li>
                ))}
              </ul>
            )

          case 'ol':
            return (
              <ol key={index} className="my-6 flex flex-col gap-3">
                {block.items.map((item, i) => (
                  <li key={i} className="flex gap-3 text-[1.05rem] leading-8 text-[#2a2824]">
                    <span className="mt-[3px] flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#eef1ff] text-sm font-bold text-accent">
                      {i + 1}
                    </span>
                    <span>
                      <RichText text={item} />
                    </span>
                  </li>
                ))}
              </ol>
            )

          case 'table':
            return (
              <div key={index} className="my-8 overflow-x-auto rounded-2xl border border-line">
                <table className="w-full min-w-[520px] border-collapse text-left text-[0.95rem] leading-6">
                  {block.caption && (
                    <caption className="px-4 pb-2 pt-4 text-left text-sm text-muted">
                      <RichText text={block.caption} />
                    </caption>
                  )}
                  <thead className="bg-[#f4f4f1]">
                    <tr>
                      {block.head.map((cell, i) => (
                        <th key={i} scope="col" className="border-b border-line px-4 py-3 font-semibold text-fg">
                          {cell}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {block.rows.map((row, r) => (
                      <tr key={r} className="border-b border-line last:border-0">
                        {row.map((cell, c) =>
                          c === 0 ? (
                            <th key={c} scope="row" className="px-4 py-3 font-semibold text-fg">
                              <RichText text={cell} />
                            </th>
                          ) : (
                            <td key={c} className="px-4 py-3 text-[#2a2824]">
                              <RichText text={cell} />
                            </td>
                          )
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )

          case 'img':
            // Unproduced illustrations (no src) are editorial briefs: visible
            // in development or with NEXT_PUBLIC_SHOW_IMAGE_BRIEFS=1, never
            // shipped as grey boxes to readers.
            if (!block.src && !SHOW_BRIEFS) return null
            return (
              <figure key={index} className="my-10">
                {block.src ? (
                  // eslint-disable-next-line @next/next/no-img-element -- images are unoptimized site-wide (see next.config.js)
                  <img
                    src={block.src}
                    alt={block.alt}
                    width={block.width ?? 1200}
                    height={block.height ?? 750}
                    loading="lazy"
                    decoding="async"
                    className={`h-auto rounded-2xl ${block.narrow ? 'mx-auto w-full max-w-[320px] border border-line' : 'w-full'}`}
                  />
                ) : (
                  // Placeholder: the image still has to be produced. The alt
                  // text doubles as the brief, so nothing ships as a broken img.
                  <div
                    role="img"
                    aria-label={block.alt}
                    className="flex aspect-[16/10] w-full items-center justify-center rounded-2xl border-2 border-dashed border-line bg-[#f4f4f1] p-8 text-center text-sm leading-6 text-muted"
                  >
                    {block.alt}
                  </div>
                )}
                {block.caption && (
                  <figcaption className={`mt-3 text-sm text-muted ${block.narrow ? 'text-center' : ''}`}>{block.caption}</figcaption>
                )}
              </figure>
            )

          case 'faq':
            return (
              <section key={index} className="my-12">
                <h2 className="mb-5 font-brand text-2xl leading-snug tracking-tight text-fg sm:text-[1.6rem]">
                  Часті питання
                </h2>
                <div className="flex flex-col divide-y divide-line rounded-2xl border border-line">
                  {block.items.map((item, i) => (
                    <details key={i} className="group px-6 py-4 [&_summary::-webkit-details-marker]:hidden">
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold text-fg">
                        <h3 className="text-[1.05rem] leading-7">{item.q}</h3>
                        <span aria-hidden className="text-accent transition-transform group-open:rotate-45">
                          +
                        </span>
                      </summary>
                      <p className="mt-3 text-[1.02rem] leading-7 text-[#2a2824]">
                        <RichText text={item.a} />
                      </p>
                    </details>
                  ))}
                </div>
              </section>
            )

          case 'cta': {
            const href = block.href.startsWith('/')
              ? `/${locale}${block.href.replace(/^\/[a-z]{2}(?=\/|$)/, '')}`
              : block.href
            return (
              <div
                key={index}
                className="my-10 flex flex-col items-start gap-4 rounded-2xl border border-[#d5ddff] bg-[#eef1ff] p-7 sm:flex-row sm:items-center sm:justify-between"
              >
                <p className="font-brand text-lg leading-snug text-fg">
                  {locale === 'en' ? 'Bring this to life with proiav' : 'Зробіть це з проЯв — під вашим брендом'}
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

          default: {
            // paragraph — first one is the lead
            const isLead = !leadUsed
            leadUsed = true
            return (
              <p
                key={index}
                className={isLead ? 'mb-6 text-xl leading-9 text-fg' : 'mb-6 text-[1.075rem] leading-8 text-[#2a2824]'}
              >
                <RichText text={block.text} />
              </p>
            )
          }
        }
      })}
    </div>
  )
}
