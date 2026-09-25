import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ImageResponse } from 'next/og'
import { getArticle } from '@/lib/blog/articles'
import { getCategory } from '@/lib/blog/categories'
import { getMarketingPage } from '@/lib/seo/pages'

export const runtime = 'nodejs'
export const revalidate = 86400

/**
 * Share cards with the page's own headline: /og/page.{id}.png,
 * /og/blog.{slug}.png, /og/tema.{slug}.png. Only titles that exist on the site
 * are rendered (no free-text query), so the endpoint can't be used to mint
 * arbitrary images under our domain. The ".png" suffix keeps the path out of
 * the locale middleware (its matcher skips paths with a dot).
 */
function loadFonts() {
  try {
    const dir = join(process.cwd(), 'src/assets/fonts')
    return [
      { name: 'Unbounded', data: readFileSync(join(dir, 'Unbounded-SemiBold.ttf')), weight: 600 as const, style: 'normal' as const },
      { name: 'Manrope', data: readFileSync(join(dir, 'Manrope-SemiBold.ttf')), weight: 600 as const, style: 'normal' as const },
    ]
  } catch {
    return undefined
  }
}

async function resolve(key: string): Promise<{ kicker: string; title: string } | null> {
  const dot = key.indexOf('.')
  if (dot < 0) return null
  const kind = key.slice(0, dot)
  const id = key.slice(dot + 1)
  if (kind === 'page' && id === 'home-en') {
    return { kicker: 'Everything after the shutter clicks', title: 'Online client galleries for photographers' }
  }
  if (kind === 'page') {
    const page = getMarketingPage(id)
    return page ? { kicker: page.ogKicker, title: page.ogTitle } : null
  }
  if (kind === 'blog') {
    const article = await getArticle(id)
    return article ? { kicker: `Блог · ${article.tags[0] ?? 'поради'}`, title: article.title } : null
  }
  if (kind === 'tema') {
    const category = getCategory(id)
    return category ? { kicker: 'Блог · тема', title: category.title } : null
  }
  return null
}

export async function GET(_req: Request, { params }: { params: { key: string } }) {
  const key = params.key.replace(/\.png$/, '')
  const data = await resolve(key)
  if (!data) return new Response('Not found', { status: 404 })

  const fonts = loadFonts()
  const long = data.title.length > 60
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '64px 72px',
          background: '#f4f4f1',
          color: '#0d0c0a',
          fontFamily: fonts ? 'Manrope' : undefined,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 10,
              border: '5px solid #0d0c0a',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <div style={{ width: 14, height: 14, borderRadius: 7, background: '#2f55ff' }} />
          </div>
          <div style={{ display: 'flex', fontSize: 34, fontFamily: fonts ? 'Unbounded' : undefined }}>
            про<span style={{ color: '#2f55ff' }}>Я</span>в
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div style={{ display: 'flex', fontSize: 26, color: '#2f55ff', textTransform: 'uppercase', letterSpacing: 3 }}>
            {data.kicker}
          </div>
          <div
            style={{
              display: 'flex',
              fontSize: long ? 54 : 68,
              lineHeight: 1.1,
              fontFamily: fonts ? 'Unbounded' : undefined,
              letterSpacing: -1,
            }}
          >
            {data.title}
          </div>
        </div>
        <div style={{ display: 'flex', fontSize: 26, color: '#6b675f' }}>proiav.space</div>
      </div>
    ),
    { width: 1200, height: 630, fonts }
  )
}
