/**
 * Launch-week walkthrough (task 1, 28.09.2026): the photographer's and the
 * client's path through the real route handlers and server actions, against
 * the throwaway database of tests/referrals/run.sh. Faked: the bucket, the
 * Monobank provider (harness), Brevo (harness outbox) and the request cookies.
 *
 *   sign-up → gallery → 20 photos + 1 video (Free: video refused) → password
 *   → client: unlock, favourites, «download all» → photographer sees the
 *   selection → checkout 129 ₴ up to the payment page (not paid) → zip import
 *   (Pixieset-style 3 folders × 5 photos) → sign-out.
 */
import assert from 'node:assert/strict'
import path from 'node:path'
import { before, describe, mock, test } from 'node:test'
import { pathToFileURL } from 'node:url'
import * as harness from '../referrals/harness'

const { anonClient, dbAvailable, installMocks, pg, provider, q, session, signUp, startProxy, userClient } = harness
const skip = !dbAvailable && 'run via tests/referrals/run.sh (needs local Postgres + PostgREST)'

const root = path.resolve(__dirname, '../..')
const modUrl = (rel: string) => pathToFileURL(path.join(root, rel)).href

// --- fakes -------------------------------------------------------------------
const bucket = new Map<string, { size: number; type: string }>()
const cookieJar = new Map<string, string>()

class Redirect extends Error {
  constructor(public url: string) {
    super(`NEXT_REDIRECT ${url}`)
  }
}

let url = ''
before(async () => {
  if (skip) return
  mock.module(modUrl('src/lib/storage/index.ts'), {
    namedExports: {
      getStorage: () => ({
        async getUploadUrl({ key }: { key: string }) {
          return { url: `https://b2.test/put/${key}`, key }
        },
        async getSignedReadUrl(key: string) {
          return `https://b2.test/${key}?X-Amz-Signature=test`
        },
        async head(key: string) {
          const object = bucket.get(key)
          return object ? { sizeBytes: object.size, contentType: object.type } : null
        },
        async delete(keys: string[]) {
          for (const key of keys) bucket.delete(key)
        },
        async list(prefix: string) {
          return [...bucket.entries()]
            .filter(([key]) => key.startsWith(prefix))
            .map(([key, o]) => ({ key, sizeBytes: o.size, lastModified: new Date() }))
        },
      }),
      galleryPrefix: (o: string, g: string) => `u/${o}/g/${g}/`,
      originalKey: (o: string, g: string, name: string) => `u/${o}/g/${g}/o/${crypto.randomUUID()}-${name}`,
      variantKey: (o: string, g: string, v: string) => `u/${o}/g/${g}/v/${v}/${crypto.randomUUID()}.jpg`,
      isVariantName: (v: string) => ['preview', 'thumb', 'poster'].includes(v),
    },
  })
  mock.module('next/headers', {
    namedExports: {
      cookies: () => ({ get: (name: string) => (cookieJar.has(name) ? { name, value: cookieJar.get(name) } : undefined) }),
    },
  })
  mock.module('next/navigation', {
    namedExports: {
      redirect: (to: string) => {
        throw new Redirect(to)
      },
      notFound: () => {
        throw new Redirect('404')
      },
    },
  })
  await installMocks()
  url = await startProxy()
})

const json = (body: unknown, cookies: Record<string, string> = {}) =>
  new Request('https://proiav.test/api', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      cookie: Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; '),
    },
    body: JSON.stringify(body),
  })

/** Wraps a Request the way Next hands it to route handlers (request.cookies). */
async function nextRequest(request: Request) {
  const { NextRequest } = await import('next/server')
  return new NextRequest(request)
}

async function upload(galleryId: string, name: string, type: string, size: number) {
  const presign = await import('@/app/api/uploads/presign/route')
  const res = await presign.POST(
    (await nextRequest(json({ galleryId, fileName: name, contentType: type, sizeBytes: size }))) as never
  )
  const body = (await res.json()) as { key?: string; error?: string }
  if (res.status !== 200) return { status: res.status, error: body.error }
  bucket.set(body.key!, { size, type }) // the browser's direct PUT
  const complete = await import('@/app/api/uploads/complete/route')
  const done = await complete.POST(
    (await nextRequest(json({ galleryId, key: body.key, contentType: type, sizeBytes: size }))) as never
  )
  return { status: done.status, ...((await done.json()) as { assetId?: string; error?: string }) }
}

describe('шлях фотографа і клієнта (Free → Базовий)', { skip }, () => {
  const email = `journey-${Math.random().toString(36).slice(2, 8)}@test.local`
  let userId = ''
  let galleryId = ''
  let slug = ''
  const assetIds: string[] = []

  test('реєстрація: профіль Free, 3 ГБ, реферальний код; до підтвердження пошти — теж профіль', () => {
    userId = signUp({ email, confirmed: false })
    const row = pg(`select plan || '|' || storage_limit_bytes || '|' || length(referral_code)
                    from public.profiles where user_id = ${q(userId)}`)
    assert.equal(row, 'free|3221225472|8')
    pg(`update auth.users set email_confirmed_at = now() where id = ${q(userId)}`)
    pg(`update public.profiles set display_name = 'Олена Фото' where user_id = ${q(userId)}`)
  })

  test('створення галереї (server action) → редірект на її сторінку, slug з імʼям фотографа', async () => {
    session.userId = userId
    const { createGallery } = await import('@/lib/actions/galleries')
    const form = new FormData()
    form.set('title', 'Весілля Анни')
    await assert.rejects(createGallery('uk', form), (err: unknown) => {
      assert.ok(err instanceof Redirect)
      galleryId = err.url.split('/').pop()!
      return true
    })
    slug = pg(`select slug from public.galleries where id = ${q(galleryId)}`)
    assert.match(slug, /^olena-foto-vesillia-anny/)
  })

  test('20 фото завантажуються; відео на Free → 403 plan_video_required, у бакеті не лишається', async () => {
    for (let i = 1; i <= 20; i++) {
      const res = await upload(galleryId, `IMG_${i}.jpg`, 'image/jpeg', 5 * 1024 * 1024)
      assert.equal(res.status, 200, `фото ${i}: ${res.error}`)
      assetIds.push(res.assetId!)
    }
    const video = await upload(galleryId, 'film.mp4', 'video/mp4', 200 * 1024 * 1024)
    assert.deepEqual(video, { status: 403, error: 'plan_video_required' })
    assert.equal(pg(`select count(*) from public.assets where gallery_id = ${q(galleryId)}`), '20')
    assert.equal(pg(`select storage_used_bytes from public.profiles where user_id = ${q(userId)}`), String(20 * 5 * 1024 * 1024))
    assert.equal([...bucket.values()].filter((o) => o.type.startsWith('video/')).length, 0)
  })

  test('пароль на галерею і публікація', async () => {
    const { updateGallerySettings, setGalleryPublished } = await import('@/lib/actions/galleries')
    const form = new FormData()
    form.set('password', 'anna2026')
    await updateGallerySettings('uk', galleryId, form)
    await setGalleryPublished('uk', galleryId, true)
    const anon = await anonClient(url).from('galleries').select('has_password').eq('slug', slug).single()
    assert.equal(anon.data?.has_password, true)
    // The hash never reaches the anon key.
    const leak = await anonClient(url).from('galleries').select('password_hash').eq('slug', slug)
    assert.ok(leak.error)
  })

  test('клієнт: без пароля архів і вибір закриті; неправильний пароль → ?error=password', async () => {
    session.userId = null
    const archive = await import('@/app/api/galleries/[slug]/archive-urls/route')
    const locked = await archive.GET((await nextRequest(new Request('https://proiav.test/x'))) as never, { params: { slug } })
    assert.equal(locked.status, 403)

    const unlock = await import('@/app/api/galleries/[slug]/unlock/route')
    const wrong = new FormData()
    wrong.set('password', 'nope')
    wrong.set('locale', 'uk')
    const res = await unlock.POST(
      (await nextRequest(new Request('https://proiav.test/x', { method: 'POST', body: wrong }))) as never,
      { params: { slug } }
    )
    assert.equal(res.status, 303)
    assert.match(res.headers.get('location') ?? '', /\/uk\/g\/.*error=password/)
  })

  test('клієнт: правильний пароль → cookie, вибір 3 фото, архів на 20 підписаних посилань', async () => {
    const unlock = await import('@/app/api/galleries/[slug]/unlock/route')
    const right = new FormData()
    right.set('password', 'anna2026')
    right.set('locale', 'uk')
    const res = await unlock.POST(
      (await nextRequest(new Request('https://proiav.test/x', { method: 'POST', body: right }))) as never,
      { params: { slug } }
    )
    const setCookie = res.headers.get('set-cookie') ?? ''
    const match = setCookie.match(/(g_unlock_[^=]+)=([0-9a-f]+)/)
    assert.ok(match, 'unlock cookie')
    cookieJar.set(match[1], match[2])

    const selections = await import('@/app/api/galleries/[slug]/selections/route')
    for (const assetId of assetIds.slice(0, 3)) {
      const pick = await selections.POST(
        (await nextRequest(json({ assetId, kind: 'favorite', selected: true }, { ct: 'client-token-1' }))) as never,
        { params: { slug } }
      )
      assert.equal(pick.status, 200)
    }

    const archive = await import('@/app/api/galleries/[slug]/archive-urls/route')
    const ok = await archive.GET((await nextRequest(new Request('https://proiav.test/x'))) as never, { params: { slug } })
    assert.equal(ok.status, 200)
    const { files } = (await ok.json()) as { files: { name: string; url: string }[] }
    assert.equal(files.length, 20)
    assert.ok(files.every((f) => /X-Amz-Signature/.test(f.url)))
    assert.equal(new Set(files.map((f) => f.name)).size, 20)
  })

  test('фотограф бачить вибране клієнта (3 фото, «favorite»)', async () => {
    const owner = userClient(url, userId)
    const { data } = await owner.from('selections').select('asset_id, kind').eq('gallery_id', galleryId)
    assert.equal(data?.length, 3)
    assert.ok(data?.every((s) => s.kind === 'favorite'))
  })

  test('checkout «Базовий», місяць: 129 ₴ → посилання на сторінку оплати Monobank, платіж pending', async () => {
    session.userId = userId
    provider.checkouts.length = 0
    const { POST } = await import('@/app/api/billing/checkout/route')
    const res = await POST((await nextRequest(json({ plan: 'basic', period: 'month' }))) as never)
    assert.equal(res.status, 200)
    const body = (await res.json()) as { url?: string }
    assert.match(body.url ?? '', /^https:\/\/pay\.test\//)
    assert.equal(provider.checkouts.length, 1)
    assert.equal(provider.checkouts[0].amount, 129)
    assert.equal(
      pg(`select status || '|' || amount::int || '|' || plan from public.payments where user_id = ${q(userId)}`),
      'pending|129|basic'
    )
    // Not paid: the plan stays Free.
    assert.equal(pg(`select plan from public.profiles where user_id = ${q(userId)}`), 'free')
  })

  test('міграція: zip у структурі Pixieset (3 папки × 5 фото) → 3 галереї по 5 фото', async () => {
    const { planZip } = await import('@/lib/import/zip-plan')
    const entries = ['Highlights', 'Ceremony', 'Party'].flatMap((folder) => [
      { path: `Anna & Taras/${folder}/`, size: 0, directory: true },
      ...[1, 2, 3, 4, 5].map((i) => ({ path: `Anna & Taras/${folder}/DSC_0${i}.jpg`, size: 1_000_000, directory: false })),
    ])
    entries.push({ path: '__MACOSX/Anna & Taras/._DSC_01.jpg', size: 100, directory: false })
    const plan = planZip('Anna & Taras.zip', entries)
    assert.deepEqual(
      plan.galleries.map((g) => [g.title, g.files.length]),
      [
        ['Anna & Taras — Ceremony', 5],
        ['Anna & Taras — Highlights', 5],
        ['Anna & Taras — Party', 5],
      ]
    )

    const start = await import('@/app/api/import/start/route')
    const res = await start.POST(
      (await nextRequest(
        json({
          zipName: 'Anna & Taras.zip',
          filesTotal: plan.filesTotal,
          galleries: plan.galleries.map((g) => ({ title: g.title, files: g.files.map((f) => ({ name: f.name, size: f.size })) })),
        })
      )) as never
    )
    assert.equal(res.status, 200)
    const started = (await res.json()) as { importId: string; galleries: { title: string; galleryId: string }[] }
    assert.equal(started.galleries.length, 3)

    for (const gallery of started.galleries) {
      const files = plan.galleries.find((g) => g.title === gallery.title)!.files
      for (const [position, file] of files.entries()) {
        const presign = await import('@/app/api/uploads/presign/route')
        const p = await presign.POST(
          (await nextRequest(
            json({ galleryId: gallery.galleryId, fileName: file.name, contentType: file.contentType, sizeBytes: file.size })
          )) as never
        )
        const { key } = (await p.json()) as { key: string }
        bucket.set(key, { size: file.size, type: file.contentType })
        const complete = await import('@/app/api/uploads/complete/route')
        const done = await complete.POST(
          (await nextRequest(
            json({
              galleryId: gallery.galleryId,
              key,
              contentType: file.contentType,
              sizeBytes: file.size,
              originalName: file.name,
              importId: started.importId,
              position,
            })
          )) as never
        )
        assert.equal(done.status, 200)
      }
    }
    const finish = await import('@/app/api/import/finish/route')
    const fin = await finish.POST((await nextRequest(json({ importId: started.importId, skippedDuplicate: 0, skippedUnsupported: plan.skippedUnsupported, skippedVideo: 0, failed: 0 }))) as never)
    assert.equal(fin.status, 200)
    const counts = pg(
      `select string_agg(c::text, ',') from (select count(a.id) c from public.galleries g
         join public.imported_galleries i on i.gallery_id = g.id
         left join public.assets a on a.gallery_id = g.id
        where g.owner_id = ${q(userId)} group by g.id) s`
    )
    assert.equal(counts, '5,5,5')
  })

  test('вихід: signOut → редірект на головну мовної версії', async () => {
    const { signOut } = await import('@/lib/actions/galleries')
    await assert.rejects(signOut('uk'), (err: unknown) => err instanceof Redirect && err.url === '/uk')
  })
})
