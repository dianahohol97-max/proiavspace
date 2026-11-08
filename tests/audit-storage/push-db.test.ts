/**
 * Міграція 0068 (сповіщення): RLS «лише власник» для підписок і налаштувань,
 * журнал надсилань — лише service role. Усі міграції накочуються на
 * локальний Postgres (helpers/local-pg.ts); без бінарників тести пропускаються.
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

const user = () => pg!.sql(`insert into auth.users (email) values ('u' || gen_random_uuid() || '@t.test') returning id`)
function as(role: 'anon' | 'authenticated', userId: string | null, query: string) {
  return pg!.trySql(`begin; set local role ${role};
    ${userId ? `select set_config('request.jwt.claim.sub', '${userId}', true);` : ''}
    ${query}; commit;`)
}
const last = (out: string) => out.trim().split('\n').pop() ?? ''
const sub = (owner: string, tag: string) => `insert into public.push_subscriptions (owner_id, endpoint, p256dh, auth, locale)
  values ('${owner}', 'https://push.example/${tag}-' || gen_random_uuid(), '${'B'.repeat(87)}', '${'a'.repeat(22)}', 'uk')`

describe('0068 push: RLS лише для власника', () => {
  test('міграція накочується без помилок, RLS увімкнено', { skip: skip() }, () => {
    assert.equal(pg!.failedMigrations['0068_push_notifications.sql'], undefined)
    for (const table of ['push_subscriptions', 'push_preferences', 'push_deliveries']) {
      assert.equal(pg!.sql(`select relrowsecurity from pg_class where oid = 'public.${table}'::regclass`), 't', table)
    }
  })

  test('власник додає, бачить і видаляє свої підписки; чужих не бачить і не чіпає', { skip: skip() }, () => {
    const a = user()
    const b = user()
    assert.ok(as('authenticated', a, sub(a, 'a')).ok)
    assert.ok(as('authenticated', b, sub(b, 'b')).ok)
    assert.equal(last(as('authenticated', a, `select count(*) from public.push_subscriptions`).out), '1')
    // Writing a row for someone else is refused.
    const foreign = as('authenticated', a, sub(b, 'x'))
    assert.ok(!foreign.ok && /row-level security/.test(foreign.out), foreign.out)
    // B's row is invisible to A: delete/update affect nothing.
    as('authenticated', a, `delete from public.push_subscriptions where owner_id = '${b}'`)
    as('authenticated', a, `update public.push_subscriptions set locale = 'en' where owner_id = '${b}'`)
    assert.equal(pg!.sql(`select count(*) || ':' || min(locale) from public.push_subscriptions where owner_id = '${b}'`), '1:uk')
    assert.ok(as('authenticated', a, `delete from public.push_subscriptions where owner_id = '${a}'`).ok)
    assert.equal(pg!.sql(`select count(*) from public.push_subscriptions where owner_id = '${a}'`), '0')
  })

  test('аноніми нічого не читають і не пишуть', { skip: skip() }, () => {
    const a = user()
    pg!.sql(sub(a, 'anon'))
    for (const table of ['push_subscriptions', 'push_preferences', 'push_deliveries']) {
      const read = as('anon', null, `select count(*) from public.${table}`)
      assert.ok(!read.ok && /permission denied/.test(read.out), `${table}: ${read.out}`)
    }
    const write = as('anon', null, sub(a, 'anon2'))
    assert.ok(!write.ok && /permission denied/.test(write.out), write.out)
  })

  test('налаштування: свої — так, чужі — ні; за замовчуванням усе увімкнено', { skip: skip() }, () => {
    const a = user()
    const b = user()
    assert.ok(as('authenticated', a, `insert into public.push_preferences (owner_id, booking) values ('${a}', false)`).ok)
    assert.equal(
      pg!.sql(`select client_picks::text || first_view::text || booking::text || storage_low::text || gallery_expiring::text from public.push_preferences where owner_id = '${a}'`),
      'truetruefalsetruetrue'
    )
    const foreign = as('authenticated', b, `insert into public.push_preferences (owner_id) values ('${a}')`)
    assert.ok(!foreign.ok, foreign.out)
    as('authenticated', b, `update public.push_preferences set booking = true where owner_id = '${a}'`)
    assert.equal(pg!.sql(`select booking from public.push_preferences where owner_id = '${a}'`), 'f')
    assert.equal(last(as('authenticated', b, `select count(*) from public.push_preferences`).out), '0')
  })

  test('журнал надсилань — недоступний навіть власнику', { skip: skip() }, () => {
    const a = user()
    pg!.sql(`insert into public.push_deliveries (owner_id, kind, dedupe_key) values ('${a}', 'booking', 'slot:1')`)
    const read = as('authenticated', a, `select count(*) from public.push_deliveries`)
    assert.ok(!read.ok && /permission denied/.test(read.out), read.out)
    const dup = pg!.trySql(`insert into public.push_deliveries (owner_id, kind, dedupe_key) values ('${a}', 'booking', 'slot:1')`)
    assert.ok(!dup.ok && /duplicate key/.test(dup.out), dup.out)
  })

  test('погані дані відхиляються; видалення акаунта забирає все каскадом', { skip: skip() }, () => {
    const a = user()
    const bad = pg!.trySql(`insert into public.push_subscriptions (owner_id, endpoint, p256dh, auth) values ('${a}', 'http://plain.example/abcdefghijklmnop', '${'B'.repeat(87)}', '${'a'.repeat(22)}')`)
    assert.ok(!bad.ok, 'http endpoint must be refused')
    const kind = pg!.trySql(`insert into public.push_deliveries (owner_id, kind, dedupe_key) values ('${a}', 'spam', 'x')`)
    assert.ok(!kind.ok)
    pg!.sql(sub(a, 'cascade'))
    pg!.sql(`insert into public.push_preferences (owner_id) values ('${a}')`)
    pg!.sql(`delete from auth.users where id = '${a}'`)
    assert.equal(pg!.sql(`select count(*) from public.push_subscriptions where owner_id = '${a}'`), '0')
    assert.equal(pg!.sql(`select count(*) from public.push_preferences where owner_id = '${a}'`), '0')
  })
})
