import Link from 'next/link'
import { JsonLd } from '@/components/seo/JsonLd'
import { breadcrumbNode, type Crumb } from '@/lib/seo/structured-data'

/** Visible breadcrumb trail + matching BreadcrumbList structured data. */
export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <>
      <JsonLd data={{ '@context': 'https://schema.org', ...breadcrumbNode(items) }} />
      <nav aria-label="Хлібні крихти" className="mx-auto max-w-5xl px-6">
        <ol className="flex flex-wrap items-center gap-2 text-xs text-muted">
          {items.map((item, i) => (
            <li key={item.path} className="flex items-center gap-2">
              {i > 0 && <span aria-hidden>/</span>}
              {i === items.length - 1 ? (
                <span aria-current="page" className="text-fg">
                  {item.name}
                </span>
              ) : (
                <Link href={item.path} className="no-underline hover:text-fg">
                  {item.name}
                </Link>
              )}
            </li>
          ))}
        </ol>
      </nav>
    </>
  )
}
