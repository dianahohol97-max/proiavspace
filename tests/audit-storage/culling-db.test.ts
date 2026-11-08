/**
 * Міграція 0059 (culling_decisions): рішення AI-відбору в акаунті.
 * Усі міграції накочуються на локальний Postgres (helpers/local-pg.ts);
 * без Postgres-бінарників тести пропускаються. Supabase не чіпаємо.
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

function account() {
  const db = pg!
  const userId = db.sql(`insert into auth.users (email) values ('u' || gen_random_uuid() || '@t.test') returning id`)
  const galleryId = db.sql(`insert into public.galleries (owner_id, slug, title, is_published)
    values ('${userId}', 'g-' || gen_random_uuid(), 'T', true) returning id`)
  const assetId = db.sql(`insert into public.assets (gallery_id, owner_id, r2_key, kind, content_type, size_bytes)
    values ('${galleryId}', '${userId}', 'u/${userId}/g/${galleryId}/o/' || gen_random_uuid(), 'photo', 'image/jpeg', 1)
    returning id`)
  return { userId, galleryId, assetId }
}

function as(role: 'anon' | 'authenticated', userId: string | null, query: string) {
  return pg!.trySql(`begin; set local role ${role};
    ${userId ? `select set_config('request.jwt.claim.sub', '${userId}', true);` : ''}
    ${query}; commit;`)
}
const last = (out: string) => out.trim().split('\n').pop() ?? ''

describe('0059 culling_decisions: RLS лише для власника', () => {
  test('міграція накочується без помилок', { skip: skip() }, () => {
    assert.equal(pg!.failedMigrations['0059_culling_decisions.sql'], undefined)
    assert.equal(pg!.sql(`select relrowsecurity from pg_class where oid = 'public.culling_decisions'::regclass`), 't')
  })

  test('власник пише, читає, змінює й видаляє свої рішення', { skip: skip() }, () => {
    const a = account()
    const ins = as('authenticated', a.userId, `insert into public.culling_decisions (asset_id, gallery_id, owner_id, decision)
      values ('${a.assetId}', '${a.galleryId}', '${a.userId}', 'confirmed')`)
    assert.ok(ins.ok, ins.out)
    const up = as('authenticated', a.userId, `update public.culling_decisions set decision = 'cleared', best_of_series = 's:${a.assetId}'
      where asset_id = '${a.assetId}'`)
    assert.ok(up.ok, up.out)
    assert.equal(last(as('authenticated', a.userId, `select decision || '|' || best_of_series from public.culling_decisions where gallery_id = '${a.galleryId}'`).out), `cleared|s:${a.assetId}`)
    assert.ok(as('authenticated', a.userId, `delete from public.culling_decisions where asset_id = '${a.assetId}'`).ok)
    assert.equal(pg!.sql(`select count(*) from public.culling_decisions where asset_id = '${a.assetId}'`), '0')
  })

  test('аноніми нічого не бачать і не пишуть', { skip: skip() }, () => {
    const a = account()
    pg!.sql(`insert into public.culling_decisions (asset_id, gallery_id, owner_id, decision) values ('${a.assetId}', '${a.galleryId}', '${a.userId}', 'confirmed')`)
    const read = as('anon', null, `select count(*) from public.culling_decisions`)
    assert.ok(!read.ok && /permission denied/.test(read.out), read.out)
    const write = as('anon', null, `insert into public.culling_decisions (asset_id, gallery_id, owner_id, decision)
      values ('${a.assetId}', '${a.galleryId}', '${a.userId}', 'cleared')`)
    assert.ok(!write.ok && /permission denied/.test(write.out), write.out)
  })

  test('інший фотограф не бачить і не змінює чужі рішення, не пише про чужий кадр', { skip: skip() }, () => {
    const a = account()
    const b = account()
    pg!.sql(`insert into public.culling_decisions (asset_id, gallery_id, owner_id, decision) values ('${a.assetId}', '${a.galleryId}', '${a.userId}', 'confirmed')`)
    assert.equal(last(as('authenticated', b.userId, `select count(*) from public.culling_decisions where gallery_id = '${a.galleryId}'`).out), '0')
    for (const write of [
      `update public.culling_decisions set decision = 'cleared' where asset_id = '${a.assetId}'`,
      `delete from public.culling_decisions where asset_id = '${a.assetId}'`,
    ]) {
      const r = as('authenticated', b.userId, write)
      assert.ok(r.ok || /row-level security|permission denied/.test(r.out), r.out)
    }
    assert.equal(pg!.sql(`select decision from public.culling_decisions where asset_id = '${a.assetId}'`), 'confirmed')
    // Чужий кадр під своїм owner_id / своєю галереєю — відмова.
    for (const values of [
      `('${a.assetId}', '${a.galleryId}', '${b.userId}', 'cleared')`,
      `('${a.assetId}', '${b.galleryId}', '${b.userId}', 'cleared')`,
      `('${a.assetId}', '${a.galleryId}', '${a.userId}', 'cleared')`,
    ]) {
      const r = as('authenticated', b.userId, `insert into public.culling_decisions (asset_id, gallery_id, owner_id, decision) values ${values}`)
      assert.ok(!r.ok && /row-level security|duplicate key/.test(r.out), r.out)
    }
  })

  test('рядок не можна «перенести» в чужу галерею; порожній рядок і зайве значення відхиляються', { skip: skip() }, () => {
    const a = account()
    const b = account()
    assert.ok(as('authenticated', a.userId, `insert into public.culling_decisions (asset_id, gallery_id, owner_id, decision)
      values ('${a.assetId}', '${a.galleryId}', '${a.userId}', 'confirmed')`).ok)
    const move = as('authenticated', a.userId, `update public.culling_decisions set gallery_id = '${b.galleryId}' where asset_id = '${a.assetId}'`)
    assert.ok(!move.ok && /row-level security/.test(move.out), move.out)
    const empty = as('authenticated', a.userId, `update public.culling_decisions set decision = null where asset_id = '${a.assetId}'`)
    assert.ok(!empty.ok && /culling_decisions_not_empty/.test(empty.out), empty.out)
    const bad = as('authenticated', a.userId, `update public.culling_decisions set decision = 'hidden' where asset_id = '${a.assetId}'`)
    assert.ok(!bad.ok && /check constraint/.test(bad.out), bad.out)
  })

  test('видалення кадру й галереї забирає рішення каскадом', { skip: skip() }, () => {
    const a = account()
    pg!.sql(`insert into public.culling_decisions (asset_id, gallery_id, owner_id, decision) values ('${a.assetId}', '${a.galleryId}', '${a.userId}', 'confirmed')`)
    pg!.sql(`delete from public.galleries where id = '${a.galleryId}'`)
    assert.equal(pg!.sql(`select count(*) from public.culling_decisions where gallery_id = '${a.galleryId}'`), '0')
  })
})
