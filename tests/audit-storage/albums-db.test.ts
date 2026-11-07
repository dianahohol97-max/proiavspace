/**
 * Конструктор альбомів (міграції 0061–0062) на локальному Postgres:
 * RLS «лише власник», анонім не бачить нічого, album_save_spread атомарно
 * замінює слоти, чужі фото й чужі проєкти не підставити.
 * Без Postgres-бінарників тести пропускаються.
 */
import assert from 'node:assert/strict'
import { after, before, describe, test } from 'node:test'
import { startLocalPg, type LocalPg } from './helpers/local-pg'

let pg: LocalPg | null = null
before(() => {
  pg = startLocalPg()
  // Як у справжньому Supabase: auth.uid() доступна API-ролям (спільний stub
  // цього не дає, а політики альбомів її викликають).
  pg?.sql('grant usage on schema auth to anon, authenticated; grant execute on all functions in schema auth to anon, authenticated')
})
after(() => pg?.stop())
const skip = () => (pg ? false : 'немає Postgres-бінарників (initdb/pg_ctl/psql)')

function account() {
  const db = pg!
  const userId = db.sql(`insert into auth.users (email) values ('a' || gen_random_uuid() || '@t.test') returning id`)
  const galleryId = db.sql(`insert into public.galleries (owner_id, slug, title)
    values ('${userId}', 'g-' || gen_random_uuid(), 'T') returning id`)
  const assetId = db.sql(`insert into public.assets (gallery_id, owner_id, r2_key, kind, content_type, size_bytes, width, height)
    values ('${galleryId}', '${userId}', 'u/${userId}/' || gen_random_uuid(), 'photo', 'image/jpeg', 1, 6000, 4000)
    returning id`)
  return { userId, galleryId, assetId }
}

function as(role: 'authenticated' | 'anon', userId: string | null, query: string) {
  const claim = userId ? `select set_config('request.jwt.claim.sub', '${userId}', true);` : ''
  const r = pg!.trySql(`begin; set local role ${role}; ${claim} ${query}; commit;`)
  return { ok: r.ok, out: r.ok ? r.out.split('\n').pop() ?? '' : r.out }
}

const SPEC = `'{"spreadWidthMm":600,"spreadHeightMm":300,"bleedMm":3,"safeMm":5,"marginMm":10,"gapMm":4,"dpi":300,"colorProfile":"srgb"}'::jsonb`

function project(owner: ReturnType<typeof account>) {
  return as('authenticated', owner.userId, `insert into public.album_projects (owner_id, title, gallery_id, spec)
    values ('${owner.userId}', 'Альбом', '${owner.galleryId}', ${SPEC}) returning id`).out
}

function spreadJson(id: string, projectId: string, assetId: string | null, slots = 2) {
  const items = Array.from({ length: slots }, (_, i) => ({
    position: i, x_mm: i * 300, y_mm: -3, w_mm: 300, h_mm: 306, asset_id: i === 0 ? assetId : null,
    zoom: 1.2, focal_x: 0.4, focal_y: 0.6,
  }))
  return JSON.stringify({ id, project_id: projectId, position: 0, kind: 'spread', layout: 'pages:p1-bleed|p1-bleed', slots: items })
}

describe('альбоми: міграції 0061–0062', () => {
  test('накочуються без помилок (разом з 0064)', { skip: skip() }, () => {
    const failed = Object.keys(pg!.failedMigrations).filter((f) => f.startsWith('006'))
    assert.deepEqual(failed, [])
  })

  test('власник створює профіль, проєкт і зберігає розворот атомарно', { skip: skip() }, () => {
    const a = account()
    const p = as('authenticated', a.userId, `insert into public.album_print_profiles (owner_id, name, spread_width_mm, spread_height_mm)
      values ('${a.userId}', '30×30', 600, 300) returning id`)
    assert.ok(p.ok, p.out)
    const projectId = project(a)
    assert.match(projectId, /^[0-9a-f-]{36}$/)
    const spreadId = pg!.sql('select gen_random_uuid()')

    let r = as('authenticated', a.userId, `select public.album_save_spread('${spreadJson(spreadId, projectId, a.assetId, 3)}'::jsonb)`)
    assert.ok(r.ok, r.out)
    assert.equal(pg!.sql(`select count(*) from public.album_slots where spread_id = '${spreadId}'`), '3')
    // Повторне збереження замінює слоти, а не дописує.
    r = as('authenticated', a.userId, `select public.album_save_spread('${spreadJson(spreadId, projectId, a.assetId, 2)}'::jsonb)`)
    assert.ok(r.ok, r.out)
    assert.equal(pg!.sql(`select count(*) from public.album_slots where spread_id = '${spreadId}'`), '2')
    assert.equal(pg!.sql(`select zoom || '|' || focal_x from public.album_slots where spread_id = '${spreadId}' and position = 0`), '1.200|0.4000')
  })

  test('невалідний слот відкочує все збереження (старі слоти лишаються)', { skip: skip() }, () => {
    const a = account()
    const projectId = project(a)
    const spreadId = pg!.sql('select gen_random_uuid()')
    as('authenticated', a.userId, `select public.album_save_spread('${spreadJson(spreadId, projectId, a.assetId, 2)}'::jsonb)`)
    const bad = JSON.parse(spreadJson(spreadId, projectId, a.assetId, 3))
    bad.slots[2].zoom = 50 // поза межами check
    const r = as('authenticated', a.userId, `select public.album_save_spread('${JSON.stringify(bad)}'::jsonb)`)
    assert.equal(r.ok, false)
    assert.equal(pg!.sql(`select count(*) from public.album_slots where spread_id = '${spreadId}'`), '2')
  })

  test('інший фотограф не бачить і не змінює чужий альбом', { skip: skip() }, () => {
    const a = account()
    const b = account()
    const projectId = project(a)
    const spreadId = pg!.sql('select gen_random_uuid()')
    as('authenticated', a.userId, `select public.album_save_spread('${spreadJson(spreadId, projectId, a.assetId)}'::jsonb)`)
    as('authenticated', a.userId, `insert into public.album_print_profiles (owner_id, name, spread_width_mm, spread_height_mm)
      values ('${a.userId}', 'A', 600, 300)`)

    for (const table of ['album_print_profiles', 'album_projects', 'album_spreads', 'album_slots']) {
      const seen = as('authenticated', b.userId, `select count(*) from public.${table} where owner_id = '${a.userId}'`)
      assert.equal(seen.out, '0', table)
    }
    // Перезаписати чужий розворот через RPC — відмова.
    const hijack = as('authenticated', b.userId, `select public.album_save_spread('${spreadJson(spreadId, projectId, b.assetId)}'::jsonb)`)
    assert.equal(hijack.ok, false)
    // Підставити чужий проєкт у свій новий розворот — відмова.
    const foreign = as('authenticated', b.userId, `select public.album_save_spread('${spreadJson(pg!.sql('select gen_random_uuid()'), projectId, b.assetId)}'::jsonb)`)
    assert.equal(foreign.ok, false)
    // Видалити чужі розвороти через sync — нічого не видаляє.
    as('authenticated', b.userId, `select public.album_sync_spreads('${projectId}', '{}')`)
    assert.equal(pg!.sql(`select count(*) from public.album_spreads where project_id = '${projectId}'`), '1')
  })

  test('чуже фото у свій слот і чужу галерею у свій проєкт не підставити', { skip: skip() }, () => {
    const a = account()
    const b = account()
    const projectId = project(b)
    const r = as('authenticated', b.userId, `select public.album_save_spread('${spreadJson(pg!.sql('select gen_random_uuid()'), projectId, a.assetId)}'::jsonb)`)
    assert.equal(r.ok, false)
    assert.match(r.out, /row-level security/)
    const g = as('authenticated', b.userId, `insert into public.album_projects (owner_id, title, gallery_id, spec)
      values ('${b.userId}', 'X', '${a.galleryId}', ${SPEC})`)
    assert.equal(g.ok, false)
  })

  test('анонім: ні читання, ні запису, ні RPC', { skip: skip() }, () => {
    const a = account()
    const projectId = project(a)
    for (const table of ['album_print_profiles', 'album_projects', 'album_spreads', 'album_slots']) {
      const r = as('anon', null, `select count(*) from public.${table}`)
      assert.equal(r.ok, false, table)
      assert.match(r.out, /permission denied/)
    }
    const rpc = as('anon', null, `select public.album_save_spread('${spreadJson(pg!.sql('select gen_random_uuid()'), projectId, null)}'::jsonb)`)
    assert.equal(rpc.ok, false)
    assert.match(rpc.out, /permission denied/)
  })

  test('sync задає порядок і видаляє прибрані розвороти; видалення фото чистить слот', { skip: skip() }, () => {
    const a = account()
    const projectId = project(a)
    const ids = [0, 1, 2].map(() => pg!.sql('select gen_random_uuid()'))
    for (const id of ids) as('authenticated', a.userId, `select public.album_save_spread('${spreadJson(id, projectId, a.assetId)}'::jsonb)`)
    const r = as('authenticated', a.userId, `select public.album_sync_spreads('${projectId}', array['${ids[2]}','${ids[0]}']::uuid[])`)
    assert.ok(r.ok, r.out)
    assert.equal(pg!.sql(`select string_agg(id::text, ',' order by position) from public.album_spreads where project_id = '${projectId}'`), `${ids[2]},${ids[0]}`)
    pg!.sql(`delete from public.assets where id = '${a.assetId}'`)
    assert.equal(pg!.sql(`select count(*) from public.album_slots s join public.album_spreads p on p.id = s.spread_id
      where p.project_id = '${projectId}' and s.asset_id is not null`), '0')
  })
})

describe('альбоми: 0064 — текст, поворот, корінець, службова галерея', () => {
  const create = (userId: string, gallery: string | null) =>
    as('authenticated', userId, `select public.album_create_project('Весілля', ${SPEC}, null, ${gallery ? `'${gallery}'` : 'null'})`)
  const galleryOf = (projectId: string) => pg!.sql(`select gallery_id from public.album_projects where id = '${projectId}'`)
  const expiry = (galleryId: string) =>
    pg!.sql(`select coalesce(to_char(free_expires_at - now(), 'DD'), 'null') from public.galleries where id = '${galleryId}'`)

  test('порожній альбом: службова галерея створюється без строку Free, позначка лише з RPC', { skip: skip() }, () => {
    const a = account()
    // Free account: an ordinary gallery gets 30 days.
    assert.match(expiry(a.galleryId), /^(29|30)$/)
    const r = create(a.userId, null)
    assert.ok(r.ok, r.out)
    const g = galleryOf(r.out)
    assert.notEqual(g, a.galleryId)
    assert.equal(pg!.sql(`select owns_gallery || '|' || (select is_published from public.galleries where id = '${g}') from public.album_projects where id = '${r.out}'`), 'true|false')
    assert.equal(expiry(g), 'null')
    // Client gallery as the source: Free rules untouched.
    const fromGallery = create(a.userId, a.galleryId)
    assert.ok(fromGallery.ok, fromGallery.out)
    assert.equal(pg!.sql(`select owns_gallery::text from public.album_projects where id = '${fromGallery.out}'`), 'false')
    assert.match(expiry(a.galleryId), /^(29|30)$/)
  })

  test('позначку не підробити: insert/update з клієнта і чужа галерея в RPC', { skip: skip() }, () => {
    const a = account()
    const b = account()
    const forged = as('authenticated', a.userId, `insert into public.album_projects (owner_id, title, gallery_id, spec, owns_gallery)
      values ('${a.userId}', 'X', '${a.galleryId}', ${SPEC}, true) returning id`)
    assert.ok(forged.ok, forged.out)
    assert.equal(pg!.sql(`select owns_gallery::text from public.album_projects where id = '${forged.out}'`), 'false')
    as('authenticated', a.userId, `update public.album_projects set owns_gallery = true where id = '${forged.out}'`)
    assert.equal(pg!.sql(`select owns_gallery::text from public.album_projects where id = '${forged.out}'`), 'false')
    assert.match(expiry(a.galleryId), /^(29|30)$/)
    // Move an existing service album onto a client gallery: refused silently (gallery_id kept).
    const own = create(a.userId, null)
    const service = galleryOf(own.out)
    as('authenticated', a.userId, `update public.album_projects set gallery_id = '${a.galleryId}' where id = '${own.out}'`)
    assert.equal(galleryOf(own.out), service)
    const foreign = create(a.userId, b.galleryId)
    assert.equal(foreign.ok, false)
    assert.equal(as('anon', null, `select public.album_create_project('X', ${SPEC}, null, null)`).ok, false)
  })

  test('опублікувала службову галерею — звичайні 30 днів; зняла з публікації — знову без строку', { skip: skip() }, () => {
    const a = account()
    const g = galleryOf(create(a.userId, null).out)
    as('authenticated', a.userId, `update public.galleries set is_published = true where id = '${g}'`)
    assert.match(expiry(g), /^(29|30)$/)
    as('authenticated', a.userId, `update public.galleries set is_published = false where id = '${g}'`)
    assert.equal(expiry(g), 'null')
    // Server-side rules (partner period end, backfills) cannot re-arm it either.
    pg!.sql(`update public.galleries set free_expires_at = now() + interval '30 days' where id = '${g}'`)
    assert.equal(expiry(g), 'null')
  })

  test('альбом видалено — службова галерея отримує звичайний строк', { skip: skip() }, () => {
    const a = account()
    const p = create(a.userId, null).out
    const g = galleryOf(p)
    as('authenticated', a.userId, `delete from public.album_projects where id = '${p}'`)
    assert.match(expiry(g), /^(29|30)$/)
  })

  test('збереження розвороту з поворотом, текстом і корінцем', { skip: skip() }, () => {
    const a = account()
    const p = create(a.userId, a.galleryId).out
    const spreadId = pg!.sql('select gen_random_uuid()')
    const spread = JSON.parse(spreadJson(spreadId, p, a.assetId, 1))
    spread.kind = 'cover'
    spread.spine_mm = 17.5
    spread.slots[0].rotation = -92.5
    spread.texts = [{ id: 't1', x: 310, y: 150, text: 'Аня & Тарас', font: 'cormorant', sizePt: 24, color: '#ffffff', align: 'center', rotation: 90, lineHeight: 1.25 }]
    const r = as('authenticated', a.userId, `select public.album_save_spread('${JSON.stringify(spread)}'::jsonb)`)
    assert.ok(r.ok, r.out)
    assert.equal(pg!.sql(`select rotation from public.album_slots where spread_id = '${spreadId}'`), '-92.50')
    assert.equal(pg!.sql(`select spine_mm || '|' || (texts -> 0 ->> 'text') from public.album_spreads where id = '${spreadId}'`), '17.5|Аня & Тарас')
    spread.texts = 'oops'
    assert.equal(as('authenticated', a.userId, `select public.album_save_spread('${JSON.stringify(spread)}'::jsonb)`).ok, false)
  })
})
