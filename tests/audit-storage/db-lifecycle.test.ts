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
  test('Free + завершений імпорт → Базовий на місяць через grace_until, без запису в payments', { skip: skip() }, () => {
    const { userId } = newAccount()
    const ends = grant(userId, completedImport(userId))
    assert.notEqual(ends, '')
    const row = pg!.sql(`select plan || '|' || storage_limit_bytes || '|' || (grace_until = '${ends}'::timestamptz)
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

  test('колишній платний, grace уже минув → промо ДАЄТЬСЯ (PR-02: так задумано?)', { skip: skip() }, () => {
    const lapsed = newAccount({ plan: 'basic', limit: BASIC, grace: new Date(Date.now() - 86400e3).toISOString() })
    assert.notEqual(grant(lapsed.userId, completedImport(lapsed.userId)), '')
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
    const queue = pg!.sql(`select count(*) from information_schema.tables
      where table_schema='public' and (table_name ilike '%deleted%' or table_name ilike '%orphan%' or table_name ilike '%purge%')`)
    assert.notEqual(queue, '0', 'після каскаду r2_key зникають з БД; об’єкти в B2 лишаються назавжди, знайти їх можна лише list-ом бакета')
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
