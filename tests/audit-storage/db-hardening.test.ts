/**
 * 0060_db_hardening на локальному Postgres (helpers/local-pg.ts):
 * search_path у normalize_email/plan_storage_bytes, тригерна функція
 * profiles_clear_free_expiry прибрана з RPC, але тригер працює,
 * а публічна галерея, обране й бронювання для anon — як раніше.
 * Без Postgres-бінарників тести пропускаються.
 */
import assert from 'node:assert/strict'
import { after, before, describe, test } from 'node:test'
import { startLocalPg, type LocalPg } from './helpers/local-pg'

let pg: LocalPg | null = null

before(() => {
  pg = startLocalPg()
})
after(() => pg?.stop())

const skip = () => (pg ? false : 'немає Postgres-бінарників (initdb/pg_ctl/psql)')

/** Runs `query` as PostgREST would for anon (or for a signed-in user). */
function as(role: 'anon' | 'authenticated', query: string, sub?: string) {
  const claims = sub ? `set local request.jwt.claim.sub = '${sub}';` : ''
  return pg!.trySql(`begin; set local role ${role}; ${claims} ${query}; commit;`)
}

function newUser(): string {
  return pg!.sql(`insert into auth.users (email) values ('u' || gen_random_uuid() || '@t.test') returning id`)
}

function publishedGallery() {
  const userId = newUser()
  const galleryId = pg!.sql(`insert into public.galleries (owner_id, slug, title, is_published)
    values ('${userId}', 'g-' || gen_random_uuid(), 'T', true) returning id`)
  const slug = pg!.sql(`select slug from public.galleries where id = '${galleryId}'`)
  const assetId = pg!.sql(`insert into public.assets (gallery_id, owner_id, r2_key, kind, content_type, size_bytes)
    values ('${galleryId}', '${userId}', 'u/${userId}/g/${galleryId}/o/0.jpg', 'photo', 'image/jpeg', 1) returning id`)
  return { userId, galleryId, slug, assetId }
}

describe('0060 міграція', () => {
  test('усі міграції накочуються на чисту БД', { skip: skip() }, () => {
    assert.deepEqual(pg!.failedMigrations, {})
  })

  test('normalize_email і plan_storage_bytes: search_path = public, результат той самий', { skip: skip() }, () => {
    for (const fn of ['normalize_email(text)', 'plan_storage_bytes(text)']) {
      assert.equal(pg!.sql(`select array_to_string(proconfig, ',') from pg_proc where oid = 'public.${fn}'::regprocedure`), 'search_path=public')
    }
    assert.equal(pg!.sql(`select public.normalize_email('Diana.H+promo@Gmail.com')`), 'diana.h@gmail.com')
    assert.equal(pg!.sql(`select public.plan_storage_bytes('basic')`), '107374182400')
    assert.equal(pg!.sql(`select public.plan_storage_bytes('free')`), '3221225472')
    // Функції лишаються доступними там, де їх викликали (вони не SECURITY DEFINER).
    assert.equal(as('authenticated', `select public.plan_storage_bytes('pro')`).ok, true)
  })
})

describe('0060 profiles_clear_free_expiry', () => {
  test('anon, authenticated і public не мають EXECUTE', { skip: skip() }, () => {
    for (const role of ['anon', 'authenticated']) {
      assert.equal(pg!.sql(`select has_function_privilege('${role}', 'public.profiles_clear_free_expiry()', 'execute')`), 'f', role)
    }
    assert.equal(
      pg!.sql(`select count(*) from pg_proc p, aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
        where p.oid = 'public.profiles_clear_free_expiry()'::regprocedure and a.grantee = 0`),
      '0',
      'PUBLIC'
    )
    const rpc = as('anon', `select public.profiles_clear_free_expiry()`)
    assert.equal(rpc.ok, false)
    assert.match(rpc.out, /permission denied/)
  })

  test('тригер і далі знімає дедлайн Free, коли роль без EXECUTE оновлює план', { skip: skip() }, () => {
    const { userId, galleryId } = publishedGallery()
    assert.notEqual(pg!.sql(`select free_expires_at from galleries where id = '${galleryId}'`), '', 'дедлайн Free виставлено')
    // service_role оновлює план у вебхуках оплати; забираємо в нього EXECUTE
    // теж, щоб довести: тригер не залежить від цього права.
    const out = pg!.sql(`begin;
      revoke execute on function public.profiles_clear_free_expiry() from service_role;
      set local role service_role;
      update public.profiles set plan = 'basic' where user_id = '${userId}';
      reset role;
      select coalesce(free_expires_at::text, 'null') from public.galleries where id = '${galleryId}';
      commit;`)
    assert.equal(out, 'null')
  })
})

describe('0060 owner_has_paid_plan', () => {
  test('anon і public без EXECUTE, authenticated і service_role — з ним', { skip: skip() }, () => {
    assert.equal(pg!.sql(`select has_function_privilege('anon', 'public.owner_has_paid_plan(uuid)', 'execute')`), 'f')
    assert.equal(
      pg!.sql(`select count(*) from pg_proc p, aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
        where p.oid = 'public.owner_has_paid_plan(uuid)'::regprocedure and a.grantee = 0`),
      '0',
      'PUBLIC'
    )
    assert.equal(pg!.sql(`select has_function_privilege('authenticated', 'public.owner_has_paid_plan(uuid)', 'execute')`), 't')
    assert.equal(pg!.sql(`select has_function_privilege('service_role', 'public.owner_has_paid_plan(uuid)', 'execute')`), 't')
    const rpc = as('anon', `select public.owner_has_paid_plan(gen_random_uuid())`)
    assert.equal(rpc.ok, false)
    assert.match(rpc.out, /permission denied/)
  })

  test('фотограф створює галерею: тригер-охоронець і далі ставить дедлайн Free', { skip: skip() }, () => {
    const userId = newUser()
    const r = as('authenticated', `insert into public.galleries (owner_id, slug, title)
      values ('${userId}', 'g-' || gen_random_uuid(), 'T') returning (free_expires_at is not null)::text`, userId)
    assert.equal(r.ok, true, r.out)
    assert.equal(r.out, 'true')
  })
})

describe('0060 release_expired_slots лише для власника', () => {
  /** Owner with auto-release after 1 h and one priced slot booked 2 h ago. */
  function expiredBooking() {
    const owner = newUser()
    const handle = 'r' + pg!.sql(`select substr(md5(random()::text), 1, 10)`)
    pg!.sql(`insert into public.booking_settings (user_id, enabled, handle, unpaid_release_hours)
             values ('${owner}', true, '${handle}', 1)`)
    const slot = pg!.sql(`insert into public.booking_slots (owner_id, starts_at, price_uah, status, client_name, booked_at)
             values ('${owner}', (now() + interval '3 days')::timestamp, 500, 'booked', 'К', now() - interval '2 hours')
             returning id`)
    return { owner, slot, status: () => pg!.sql(`select status from public.booking_slots where id = '${slot}'`) }
  }

  test('чужий залогінений користувач: нічого не звільняє', { skip: skip() }, () => {
    const b = expiredBooking()
    const stranger = newUser()
    const r = as('authenticated', `select public.release_expired_slots('${b.owner}')`, stranger)
    assert.equal(r.ok, true, r.out)
    assert.equal(r.out, '0')
    assert.equal(b.status(), 'booked')
  })

  test('власник у кабінеті: звільняє свої прострочені', { skip: skip() }, () => {
    const b = expiredBooking()
    const r = as('authenticated', `select public.release_expired_slots('${b.owner}')`, b.owner)
    assert.equal(r.out, '1', r.out)
    assert.equal(b.status(), 'free')
  })

  test('сервісна роль і серверні задачі (без auth.uid()): працюють як раніше', { skip: skip() }, () => {
    const b = expiredBooking()
    assert.equal(pg!.sql(`begin; set local role service_role; select public.release_expired_slots('${b.owner}'); commit;`), '1')
    assert.equal(b.status(), 'free')
    const c = expiredBooking()
    assert.equal(pg!.sql(`select public.release_expired_slots('${c.owner}')`), '1')
    assert.equal(c.status(), 'free')
  })

  test('anon як і раніше не може викликати', { skip: skip() }, () => {
    const r = as('anon', `select public.release_expired_slots(gen_random_uuid())`)
    assert.equal(r.ok, false)
    assert.match(r.out, /permission denied/)
  })
})

describe('0060 публічна галерея, обране, бронювання працюють для anon', () => {
  test('публічні SECURITY DEFINER функції досі доступні anon', { skip: skip() }, () => {
    const keep = [
      'book_slot(uuid,text,text,text)', 'gallery_is_open(uuid)', 'gallery_is_public(uuid)',
      'get_booking_profile(text)', 'get_free_slots(text)', 'get_gallery_branding(text)',
      'get_published_site_handles()', 'get_site(text)', 'get_site_galleries(text)', 'get_site_portfolio(text)',
      'list_selections(uuid,text)', 'owner_galleries_closed(uuid)',
      'public_gallery_state(text)', 'record_gallery_archive(uuid)', 'record_gallery_download(uuid,uuid)',
      'record_gallery_view(text)', 'record_photo_view(text,uuid)', 'record_site_lead(text,text,text,text)',
      'set_selection(text,uuid,text,boolean,text)',
    ]
    for (const fn of keep) {
      assert.equal(pg!.sql(`select has_function_privilege('anon', 'public.${fn}', 'execute')`), 't', fn)
    }
  })

  test('галерея: читання, стан, брендинг, перегляди, завантаження', { skip: skip() }, () => {
    const g = publishedGallery()
    const read = as('anon', `select count(*) from public.galleries where slug = '${g.slug}'`)
    assert.equal(read.out, '1', read.out)
    assert.equal(as('anon', `select count(*) from public.assets where gallery_id = '${g.galleryId}'`).out, '1')
    assert.equal(as('anon', `select public.public_gallery_state('${g.slug}')`).out, 'open')
    assert.equal(as('anon', `select public.gallery_is_public('${g.galleryId}')`).out, 't')
    assert.equal(as('anon', `select count(*) from public.get_gallery_branding('${g.slug}')`).ok, true)
    for (const q of [
      `select public.record_gallery_view('${g.slug}')`,
      `select public.record_photo_view('${g.slug}', '${g.assetId}')`,
      `select public.record_gallery_download('${g.galleryId}', '${g.assetId}')`,
      `select public.record_gallery_archive('${g.galleryId}')`,
    ]) {
      const r = as('anon', q)
      assert.equal(r.ok, true, `${q}: ${r.out}`)
    }
    assert.notEqual(pg!.sql(`select count(*) from public.gallery_events where gallery_id = '${g.galleryId}'`), '0')
  })

  test('обране: set_selection + list_selections', { skip: skip() }, () => {
    const g = publishedGallery()
    const set = as('anon', `select public.set_selection('${g.slug}', '${g.assetId}', 'favorite', true, 'client-token-123456')`)
    assert.equal(set.ok, true, set.out)
    const list = as('anon', `select asset_id || ':' || kind from public.list_selections('${g.galleryId}', 'client-token-123456')`)
    assert.equal(list.out, `${g.assetId}:favorite`)
  })

  test('бронювання: профіль, вільні слоти, бронь', { skip: skip() }, () => {
    const userId = newUser()
    const handle = 'b' + pg!.sql(`select substr(md5(random()::text), 1, 10)`)
    pg!.sql(`insert into public.booking_settings (user_id, enabled, handle, card_enabled, card_details)
             values ('${userId}', true, '${handle}', true, '1234')`)
    const slot = pg!.sql(`insert into public.booking_slots (owner_id, starts_at)
             values ('${userId}', (now() + interval '3 days')::timestamp) returning id`)
    assert.equal(as('anon', `select card_details from public.get_booking_profile('${handle}')`).out, '1234')
    assert.equal(as('anon', `select id from public.get_free_slots('${handle}')`).out, slot)
    const token = as('anon', `select public.book_slot('${slot}', 'Клієнтка', '+380000000000', 'c@t.test')`)
    assert.equal(token.ok, true, token.out)
    assert.match(token.out, /^[0-9a-f-]{36}$/)
    assert.equal(pg!.sql(`select status from public.booking_slots where id = '${slot}'`), 'booked')
  })
})
