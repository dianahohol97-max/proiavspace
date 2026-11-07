/**
 * Блоки 1.1, 1.5, 4.1 на рівні БД: усі міграції накочуються на локальний
 * Postgres (helpers/local-pg.ts), далі — справжні тригери й функції.
 * Без Postgres-бінарників тести пропускаються.
 */
import assert from 'node:assert/strict'
import { after, before, describe, test } from 'node:test'
import { startLocalPg, type LocalPg } from './helpers/local-pg'

const GB = 1024 ** 3
const BASIC = 100 * GB
const DEADLINE_FUTURE = '2027-01-01T00:00:00+02:00'

let pg: LocalPg | null = null

before(() => {
  pg = startLocalPg()
})
after(() => pg?.stop())

const skip = () => (pg ? false : 'немає Postgres-бінарників (initdb/pg_ctl/psql)')

/** auth user → profile (handle_new_user trigger) → one gallery. */
function newAccount(opts: { plan?: string; limit?: number; used?: number; grace?: string | null } = {}) {
  const db = pg!
  const userId = db.sql(`insert into auth.users (email) values ('u' || gen_random_uuid() || '@t.test') returning id`)
  db.sql(`update public.profiles set plan = '${opts.plan ?? 'free'}',
            storage_limit_bytes = ${opts.limit ?? 3 * GB},
            storage_used_bytes = ${opts.used ?? 0},
            grace_until = ${opts.grace === undefined || opts.grace === null ? 'null' : `'${opts.grace}'`}
          where user_id = '${userId}'`)
  const galleryId = db.sql(`insert into public.galleries (owner_id, slug, title)
    values ('${userId}', 'g-' || gen_random_uuid(), 'T') returning id`)
  return { userId, galleryId }
}

function completedImport(userId: string, files = 1): string {
  return pg!.sql(`insert into public.gallery_imports (owner_id, zip_name, status, imported_count)
    values ('${userId}', 'a.zip', 'completed', ${files}) returning id`)
}

function grant(userId: string, importId: string, maxGrants = 30, deadline = DEADLINE_FUTURE): string {
  return pg!.sql(`select public.grant_import_promo('${userId}', '${importId}', ${BASIC}, ${maxGrants}, '${deadline}')`)
}

describe('міграції', () => {
  test('усі міграції накочуються на чисту БД', { skip: skip() }, () => {
    assert.deepEqual(pg!.failedMigrations, {})
  })
})

describe('1.1 облік місця в БД', () => {
  test('тригер рахує insert/delete assets і portfolio_assets, не йде в мінус', { skip: skip() }, () => {
    const { userId, galleryId } = newAccount()
    pg!.sql(`insert into public.assets (gallery_id, owner_id, r2_key, kind, content_type, size_bytes)
             values ('${galleryId}', '${userId}', 'k1', 'photo', 'image/jpeg', 1000)`)
    pg!.sql(`insert into public.portfolio_assets (owner_id, r2_key, content_type, size_bytes)
             values ('${userId}', 'p1', 'image/jpeg', 500)`)
    assert.equal(pg!.sql(`select storage_used_bytes from profiles where user_id='${userId}'`), '1500')
    pg!.sql(`delete from public.galleries where id='${galleryId}'`) // cascade → assets
    assert.equal(pg!.sql(`select storage_used_bytes from profiles where user_id='${userId}'`), '500')
  })

  test('ST-01: тригер 0045 відхиляє вставку понад storage_limit_bytes (assets і portfolio_assets)', { skip: skip() }, () => {
    const { userId, galleryId } = newAccount({ plan: 'basic', limit: BASIC, used: BASIC - 1 })
    const r = pg!.trySql(`insert into public.assets (gallery_id, owner_id, r2_key, kind, content_type, size_bytes)
             values ('${galleryId}', '${userId}', 'k-over', 'photo', 'image/jpeg', ${200 * 1024 ** 2})`)
    assert.equal(r.ok, false)
    assert.match(r.out, /storage_quota_exceeded/)
    const p = pg!.trySql(`insert into public.portfolio_assets (owner_id, r2_key, content_type, size_bytes)
             values ('${userId}', 'p-over', 'image/jpeg', 2)`)
    assert.match(p.out, /storage_quota_exceeded/)
    // Exactly to the limit is still fine.
    pg!.sql(`insert into public.assets (gallery_id, owner_id, r2_key, kind, content_type, size_bytes)
             values ('${galleryId}', '${userId}', 'k-fit', 'photo', 'image/jpeg', 1)`)
    assert.equal(pg!.sql(`select storage_used_bytes from profiles where user_id='${userId}'`), String(BASIC))
  })

  test('ST-01: після grace ліміт у БД = Free (3 ГБ), навіть якщо storage_limit_bytes = 100 ГБ', { skip: skip() }, () => {
    const lapsed = newAccount({ plan: 'basic', limit: BASIC, used: 3 * GB, grace: new Date(Date.now() - 60e3).toISOString() })
    const r = pg!.trySql(`insert into public.assets (gallery_id, owner_id, r2_key, kind, content_type, size_bytes)
             values ('${lapsed.galleryId}', '${lapsed.userId}', 'k-lapsed', 'photo', 'image/jpeg', 1)`)
    assert.match(r.out, /storage_quota_exceeded/)
    const inGrace = newAccount({ plan: 'basic', limit: BASIC, used: 3 * GB, grace: new Date(Date.now() + 60e3).toISOString() })
    pg!.sql(`insert into public.assets (gallery_id, owner_id, r2_key, kind, content_type, size_bytes)
             values ('${inGrace.galleryId}', '${inGrace.userId}', 'k-grace', 'photo', 'image/jpeg', 1)`)
  })

  test('ST-01: два одночасних insert — другий чекає на лок і бачить байти першого', { skip: skip() }, async () => {
    const { userId, galleryId } = newAccount({ plan: 'basic', limit: BASIC, used: BASIC - 100 })
    const insert = (key: string) =>
      `insert into public.assets (gallery_id, owner_id, r2_key, kind, content_type, size_bytes)
       values ('${galleryId}', '${userId}', '${key}', 'photo', 'image/jpeg', 60)`
    // Session A holds the lock inside an open transaction while B tries.
    const results = await Promise.all([
      pg!.trySqlAsync(`begin; ${insert('a')}; select pg_sleep(1); commit;`),
      new Promise<{ ok: boolean; out: string }>((resolve) =>
        setTimeout(() => resolve(pg!.trySql(insert('b'))), 200)
      ),
    ])
    assert.equal(results[0].ok, true, results[0].out)
    assert.match(results[1].out, /storage_quota_exceeded/)
    assert.equal(pg!.sql(`select storage_used_bytes from profiles where user_id='${userId}'`), String(BASIC - 40))
  })
})

describe('1.5 промо імпорту (grant_import_promo)', () => {
  test('Free + завершений імпорт → Базовий на місяць (+14 днів grace), без запису в payments', { skip: skip() }, () => {
    const { userId } = newAccount()
    const ends = grant(userId, completedImport(userId))
    assert.notEqual(ends, '')
    const row = pg!.sql(`select plan || '|' || storage_limit_bytes || '|' || (grace_until = '${ends}'::timestamptz + interval '14 days')
                         from profiles where user_id='${userId}'`)
    assert.equal(row, `basic|${BASIC}|true`)
    assert.equal(pg!.sql(`select count(*) from payments where user_id='${userId}'`), '0')
  })

  test('промо-місяць не рахується як оплата для рефералів: referral лишається pending, earnings нема', { skip: skip() }, () => {
    const referrer = newAccount()
    const code = pg!.sql(`select referral_code from profiles where user_id='${referrer.userId}'`)
    const referred = pg!.sql(`insert into auth.users (email, raw_user_meta_data)
      values ('r' || gen_random_uuid() || '@t.test', '{"ref":"${code}"}') returning id`)
    assert.equal(pg!.sql(`select status from referrals where referred_id='${referred}'`), 'pending')
    grant(referred, completedImport(referred))
    assert.equal(pg!.sql(`select status from referrals where referred_id='${referred}'`), 'pending')
    const earnings = pg!.trySql(`select count(*) from referral_earnings where referred_id='${referred}'`)
    if (earnings.ok) assert.equal(earnings.out, '0')
    assert.equal(pg!.sql(`select credit_balance_kop from profiles where user_id='${referrer.userId}'`), '0')
  })

  test('імпорт удруге з того самого акаунта → промо не дається вдруге', { skip: skip() }, () => {
    const { userId } = newAccount()
    assert.notEqual(grant(userId, completedImport(userId)), '')
    assert.equal(grant(userId, completedImport(userId)), '')
  })

  test('імпорт без жодного файлу або незавершений → промо нема', { skip: skip() }, () => {
    const { userId } = newAccount()
    assert.equal(grant(userId, completedImport(userId, 0)), '')
    const running = pg!.sql(`insert into public.gallery_imports (owner_id, zip_name) values ('${userId}', 'a.zip') returning id`)
    assert.equal(grant(userId, running), '')
  })

  test('чужий import_id → промо нема', { skip: skip() }, () => {
    const a = newAccount()
    const b = newAccount()
    assert.equal(grant(b.userId, completedImport(a.userId)), '')
  })

  test('діючий платний тариф або активна підписка → промо нема', { skip: skip() }, () => {
    const paid = newAccount({ plan: 'basic', limit: BASIC, grace: null })
    assert.equal(grant(paid.userId, completedImport(paid.userId)), '')
    const inGrace = newAccount({ plan: 'plus', grace: new Date(Date.now() + 86400e3).toISOString() })
    assert.equal(grant(inGrace.userId, completedImport(inGrace.userId)), '')
  })

  test('PR-02: колишній платний, grace уже минув → промо дається (раз на акаунт, незалежно від оплат)', { skip: skip() }, () => {
    const lapsed = newAccount({ plan: 'basic', limit: BASIC, grace: new Date(Date.now() - 86400e3).toISOString() })
    assert.notEqual(grant(lapsed.userId, completedImport(lapsed.userId)), '')
  })

  test('PR-02: промо — один раз на акаунт назавжди, навіть після оплат і нового grace', { skip: skip() }, () => {
    const { userId } = newAccount()
    assert.notEqual(grant(userId, completedImport(userId)), '')
    pg!.sql(`update public.profiles set plan = 'free', grace_until = now() - interval '1 day' where user_id = '${userId}'`)
    assert.equal(grant(userId, completedImport(userId)), '')
  })

  test('LC-01: промо дає 14 днів grace після безкоштовного місяця', { skip: skip() }, () => {
    const { userId } = newAccount()
    const ends = grant(userId, completedImport(userId))
    const days = pg!.sql(
      `select extract(epoch from (grace_until - '${ends}'::timestamptz)) / 86400 from public.profiles where user_id = '${userId}'`
    )
    assert.equal(Math.round(Number(days)), 14)
  })

  test('після дедлайну → промо нема', { skip: skip() }, () => {
    const { userId } = newAccount()
    assert.equal(grant(userId, completedImport(userId), 30, '2020-01-01T00:00:00Z'), '')
  })

  test('лічильник «перші N»: N-й отримує, N+1-й — ні', { skip: skip() }, () => {
    pg!.sql('delete from promo_grants')
    const users = Array.from({ length: 4 }, () => newAccount())
    const results = users.map(({ userId }) => grant(userId, completedImport(userId), 3))
    assert.deepEqual(results.map((r) => r !== ''), [true, true, true, false])
  })

  test('[PR-01] видалений акаунт не звільняє слот «перших 30»', { skip: skip() }, () => {
    pg!.sql('delete from promo_grants')
    const users = Array.from({ length: 3 }, () => newAccount())
    for (const { userId } of users) grant(userId, completedImport(userId), 3)
    // Акаунт видаляють через Supabase Auth — promo_grants чиститься каскадом.
    pg!.sql(`delete from auth.users where id='${users[0].userId}'`)
    const late = newAccount()
    assert.equal(
      grant(late.userId, completedImport(late.userId), 3),
      '',
      'слот звільнився: count(*) з promo_grants падає після каскадного видалення'
    )
    // Рядок промо лишився без власника, з позначкою, коли акаунт видалили (0056).
    assert.equal(
      pg!.sql(`select count(*) || '|' || count(user_deleted_at) from promo_grants where user_id is null`),
      '1|1'
    )
  })
})

describe('4.1 видалення акаунта через Supabase Auth', () => {
  test('каскад прибирає профіль, галереї, assets — і квоту', { skip: skip() }, () => {
    const { userId, galleryId } = newAccount()
    pg!.sql(`insert into public.assets (gallery_id, owner_id, r2_key, kind, content_type, size_bytes)
             values ('${galleryId}', '${userId}', 'u/${userId}/g/${galleryId}/o/x.jpg', 'photo', 'image/jpeg', 10)`)
    pg!.sql(`delete from auth.users where id='${userId}'`)
    assert.equal(pg!.sql(`select count(*) from assets where owner_id='${userId}'`), '0')
    assert.equal(pg!.sql(`select count(*) from profiles where user_id='${userId}'`), '0')
  })

  test('[LC-02] ключі файлів видаленого акаунта мають лишитися в черзі на видалення з B2', { skip: skip() }, () => {
    const { userId, galleryId } = newAccount()
    const orig = `u/${userId}/g/${galleryId}/o/x.jpg`
    pg!.sql(`insert into public.assets (gallery_id, owner_id, r2_key, kind, content_type, size_bytes, variants)
             values ('${galleryId}', '${userId}', '${orig}', 'photo', 'image/jpeg', 10,
                     '{"thumb": "u/${userId}/g/${galleryId}/t/x.jpg", "preview": "u/${userId}/g/${galleryId}/p/x.jpg"}')`)
    pg!.sql(`insert into public.portfolio_assets (owner_id, r2_key, content_type, size_bytes)
             values ('${userId}', 'u/${userId}/portfolio/y.jpg', 'image/jpeg', 5)`)
    pg!.sql(`delete from auth.users where id='${userId}'`)
    assert.equal(pg!.sql(`select count(*) from assets where owner_id='${userId}'`), '0', 'рядки все одно прибираються каскадом')
    const queued = pg!.sql(`select kind || ' ' || key from storage_purge_queue
      where owner_id='${userId}' and purged_at is null order by kind, key`).split('\n')
    assert.deepEqual(queued, [
      `object u/${userId}/g/${galleryId}/o/x.jpg`,
      `object u/${userId}/g/${galleryId}/p/x.jpg`,
      `object u/${userId}/g/${galleryId}/t/x.jpg`,
      `object u/${userId}/portfolio/y.jpg`,
      `prefix u/${userId}/`,
    ])
  })

  test('[LC-02] звичайне видалення фото черги не чіпає; анонім черги не бачить', { skip: skip() }, () => {
    const { userId, galleryId } = newAccount()
    pg!.sql(`insert into public.assets (gallery_id, owner_id, r2_key, kind, content_type, size_bytes)
             values ('${galleryId}', '${userId}', 'u/${userId}/g/${galleryId}/o/z.jpg', 'photo', 'image/jpeg', 10)`)
    pg!.sql(`delete from public.galleries where id='${galleryId}'`)
    assert.equal(pg!.sql(`select count(*) from storage_purge_queue where owner_id='${userId}'`), '0')
    const anon = pg!.trySql(`begin; set local role anon; select count(*) from public.storage_purge_queue; commit;`)
    assert.equal(anon.ok, false)
    assert.match(anon.out, /permission denied/)
  })

  test('LC-03: Auth-видалення реферала й реферера проходить (FK 0046)', { skip: skip() }, () => {
    const referrer = newAccount()
    const code = pg!.sql(`select referral_code from profiles where user_id='${referrer.userId}'`)
    const referred = pg!.sql(`insert into auth.users (email, raw_user_meta_data)
      values ('d' || gen_random_uuid() || '@t.test', '{"ref":"${code}"}') returning id`)
    const r = pg!.trySql(`delete from auth.users where id='${referred}'`)
    assert.equal(r.ok, true, r.out)
    const r2 = pg!.trySql(`delete from auth.users where id='${referrer.userId}'`)
    assert.equal(r2.ok, true, r2.out)
  })

  test('LC-03: видалення реферера лишає ledger referral_earnings з null, а профіль реферала — з referred_by = null', { skip: skip() }, () => {
    const referrer = newAccount()
    const code = pg!.sql(`select referral_code from profiles where user_id='${referrer.userId}'`)
    const referred = pg!.sql(`insert into auth.users (email, raw_user_meta_data)
      values ('e' || gen_random_uuid() || '@t.test', '{"ref":"${code}"}') returning id`)
    pg!.sql(`insert into public.referral_earnings (referrer_id, referred_id, amount_kop, kind)
             values ('${referrer.userId}', '${referred}', 1290, 'credit')`)
    pg!.sql(`delete from auth.users where id='${referrer.userId}'`)
    assert.equal(pg!.sql(`select referred_by is null from profiles where user_id='${referred}'`), 't')
    assert.equal(pg!.sql(`select referrer_id is null from referral_earnings where referred_id='${referred}'`), 't')
  })
})

/** Runs `query` as PostgREST would for anon (or for a signed-in user). */
function as(role: 'anon' | 'authenticated', query: string, sub?: string) {
  const claims = sub ? `set local request.jwt.claim.sub = '${sub}';` : ''
  return pg!.trySql(`begin; set local role ${role}; ${claims} ${query}; commit;`)
}

function publishedGalleryWith(hidden: boolean[]) {
  const acc = newAccount()
  pg!.sql(`update public.galleries set is_published = true where id = '${acc.galleryId}'`)
  const slug = pg!.sql(`select slug from public.galleries where id = '${acc.galleryId}'`)
  const ids = hidden.map((h, i) =>
    pg!.sql(`insert into public.assets (gallery_id, owner_id, r2_key, kind, content_type, size_bytes, position, hidden_from_client)
             values ('${acc.galleryId}', '${acc.userId}', 'u/${acc.userId}/g/${acc.galleryId}/o/${i}.jpg', 'photo', 'image/jpeg', 1, ${i}, ${h})
             returning id`)
  )
  return { ...acc, slug, ids }
}

describe('0054 «приховано від клієнта»', () => {
  test('за замовчуванням кадр видно (false)', { skip: skip() }, () => {
    const { userId, galleryId } = newAccount()
    const id = pg!.sql(`insert into public.assets (gallery_id, owner_id, r2_key, kind, content_type, size_bytes)
             values ('${galleryId}', '${userId}', 'k-def-${userId}', 'photo', 'image/jpeg', 1) returning id`)
    assert.equal(pg!.sql(`select hidden_from_client from assets where id = '${id}'`), 'f')
  })

  test('анонім (публічна галерея, архів через RLS) не бачить прихованих; власник бачить усі', { skip: skip() }, () => {
    const g = publishedGalleryWith([false, true, false])
    const anon = as('anon', `select string_agg(id::text, ',' order by position) from public.assets where gallery_id = '${g.galleryId}'`)
    assert.equal(anon.ok, true, anon.out)
    assert.equal(anon.out, `${g.ids[0]},${g.ids[2]}`)
    const anonHidden = as('anon', `select count(*) from public.assets where id = '${g.ids[1]}'`)
    assert.equal(anonHidden.out, '0', 'прямий запит за id теж нічого не дає')
    const owner = as('authenticated', `select count(*) from public.assets where gallery_id = '${g.galleryId}'`, g.userId)
    assert.equal(owner.out, '3')
    const stranger = newAccount()
    const other = as('authenticated', `select count(*) from public.assets where gallery_id = '${g.galleryId}'`, stranger.userId)
    assert.equal(other.out, '2', 'чужий залогінений користувач — як анонім')
  })

  test('вибір клієнта: прихований кадр обрати не можна, видимий — можна', { skip: skip() }, () => {
    const g = publishedGalleryWith([false, true])
    const ok = as('anon', `select public.set_selection('${g.slug}', '${g.ids[0]}', 'favorite', true, 'tok')`)
    assert.equal(ok.ok, true, ok.out)
    const hidden = as('anon', `select public.set_selection('${g.slug}', '${g.ids[1]}', 'favorite', true, 'tok')`)
    assert.equal(hidden.ok, false)
    assert.match(hidden.out, /asset_not_in_gallery/)
  })

  test('статистика: завантаження й перегляд прихованого кадру не пишуться', { skip: skip() }, () => {
    const g = publishedGalleryWith([false, true])
    for (const id of g.ids) {
      assert.equal(as('anon', `select public.record_gallery_download('${g.galleryId}', '${id}')`).ok, true)
      assert.equal(as('anon', `select public.record_photo_view('${g.slug}', '${id}')`).ok, true)
    }
    assert.equal(
      pg!.sql(`select count(*) from gallery_events where gallery_id = '${g.galleryId}' and meta ->> 'asset_id' = '${g.ids[1]}'`),
      '0'
    )
    assert.equal(
      pg!.sql(`select count(*) from gallery_events where gallery_id = '${g.galleryId}' and meta ->> 'asset_id' = '${g.ids[0]}'`),
      '2'
    )
  })

  test('анонім не може сам зняти позначку', { skip: skip() }, () => {
    const g = publishedGalleryWith([true])
    const r = as('anon', `update public.assets set hidden_from_client = false where id = '${g.ids[0]}'`)
    assert.equal(r.ok, false)
    const owner = as('authenticated', `update public.assets set hidden_from_client = false where id = '${g.ids[0]}'`, g.userId)
    assert.equal(owner.ok, false, 'писати позначку може лише service role (0041)')
  })
})

describe('0053, 0055 нові поля', () => {
  test('assets.thumbhash — необов’язковий текст; сміття довше 100 символів не приймається', { skip: skip() }, () => {
    const { userId, galleryId } = newAccount()
    const id = pg!.sql(`insert into public.assets (gallery_id, owner_id, r2_key, kind, content_type, size_bytes)
             values ('${galleryId}', '${userId}', 'k-th-${userId}', 'photo', 'image/jpeg', 1) returning id`)
    assert.equal(pg!.sql(`select thumbhash is null from assets where id = '${id}'`), 't')
    pg!.sql(`update public.assets set thumbhash = 'HBkSHYSIeHiPiHh8eJd4eTN0EEQG' where id = '${id}'`)
    const bad = pg!.trySql(`update public.assets set thumbhash = repeat('a', 101) where id = '${id}'`)
    assert.match(bad.out, /assets_thumbhash_len/)
  })

  test('galleries.delivery_status / delivery_eta: читаються анонімом, статус лише зі списку', { skip: skip() }, () => {
    const g = publishedGalleryWith([])
    pg!.sql(`update public.galleries set delivery_status = 'editing', delivery_eta = '2026-12-01' where id = '${g.galleryId}'`)
    const anon = as('anon', `select delivery_status || '|' || delivery_eta from public.galleries where id = '${g.galleryId}'`)
    assert.equal(anon.ok, true, anon.out)
    assert.equal(anon.out, 'editing|2026-12-01')
    for (const s of ['shot', 'ready']) {
      pg!.sql(`update public.galleries set delivery_status = '${s}' where id = '${g.galleryId}'`)
    }
    const bad = pg!.trySql(`update public.galleries set delivery_status = 'done' where id = '${g.galleryId}'`)
    assert.match(bad.out, /galleries_delivery_status_check/)
    pg!.sql(`update public.galleries set delivery_status = null, delivery_eta = null where id = '${g.galleryId}'`)
  })
})
