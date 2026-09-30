/**
 * Ізоляція акаунтів у кабінеті: фотограф бачить і змінює лише свої галереї.
 *
 * 30.09 на проді дашборд показував користувачці чужі опубліковані галереї:
 * запит у /dashboard не фільтрував за owner_id, а RLS-політика
 * «galleries: public read when published» (потрібна для клієнтських сторінок)
 * пускає будь-яку роль, зокрема залогіненого фотографа.
 *
 * Частина 1 — справжній Postgres з усіма міграціями (helpers/local-pg.ts):
 * фіксує, що RLS сам по собі чужі опубліковані галереї НЕ ховає (тому фільтр
 * у коді обов'язковий), і що змінити/видалити чуже RLS не дає.
 * Частина 2 — код: кожен запит до galleries у кабінеті через клієнт
 * користувача фільтрує за owner_id.
 */
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { after, before, describe, test } from 'node:test'
import { startLocalPg, type LocalPg } from './helpers/local-pg'

const ROOT = join(__dirname, '..', '..')

let pg: LocalPg | null = null
before(() => {
  pg = startLocalPg()
})
after(() => pg?.stop())
const skip = () => (pg ? false : 'немає Postgres-бінарників (initdb/pg_ctl/psql)')

function account(published: boolean) {
  const db = pg!
  const userId = db.sql(`insert into auth.users (email) values ('u' || gen_random_uuid() || '@t.test') returning id`)
  const galleryId = db.sql(`insert into public.galleries (owner_id, slug, title, is_published)
    values ('${userId}', 'g-' || gen_random_uuid(), 'T', ${published}) returning id`)
  const assetId = db.sql(`insert into public.assets (gallery_id, owner_id, r2_key, kind, content_type, size_bytes)
    values ('${galleryId}', '${userId}', 'u/${userId}/g/${galleryId}/o/' || gen_random_uuid(), 'photo', 'image/jpeg', 1)
    returning id`)
  return { userId, galleryId, assetId }
}

/** Runs `query` as the signed-in user (role authenticated, auth.uid() = userId). */
function asUser(userId: string, query: string): string {
  const out = pg!.sql(`begin;
    set local role authenticated;
    select set_config('request.jwt.claim.sub', '${userId}', true);
    ${query};
    commit;`)
  // psql prints every statement's result; the query's is the last line.
  return out.split('\n').pop() ?? ''
}

describe('RLS: що бачить і що може змінити інший залогінений фотограф', () => {
  test('без фільтра за власником RLS віддає чужу опубліковану галерею — тому фільтр у коді обов’язковий', { skip: skip() }, () => {
    const a = account(true)
    const b = account(false)
    const seen = asUser(b.userId, `select count(*) from public.galleries where id = '${a.galleryId}'`)
    assert.equal(seen, '1', 'політика public read пускає і authenticated — якщо це змінилось, оновіть коментар у dashboard/page.tsx')
    const own = asUser(b.userId, `select count(*) from public.galleries where owner_id = '${b.userId}' and id = '${a.galleryId}'`)
    assert.equal(own, '0')
  })

  test('чужу галерею не можна змінити, опублікувати чи видалити', { skip: skip() }, () => {
    const a = account(true)
    const b = account(false)
    for (const write of [
      `update public.galleries set title = 'hacked' where id = '${a.galleryId}'`,
      `update public.galleries set is_published = false where id = '${a.galleryId}'`,
      `update public.galleries set owner_id = '${b.userId}' where id = '${a.galleryId}'`,
      `delete from public.galleries where id = '${a.galleryId}'`,
    ]) {
      const r = pg!.trySql(`begin; set local role authenticated;
        select set_config('request.jwt.claim.sub', '${b.userId}', true); ${write}; commit;`)
      // Either RLS filters the row out (0 rows) or the statement is refused.
      assert.ok(r.ok || /permission denied|row-level security/.test(r.out), r.out)
    }
    assert.equal(pg!.sql(`select title || '|' || is_published || '|' || owner_id from public.galleries where id = '${a.galleryId}'`), `T|true|${a.userId}`)
  })

  test('фото в чужій галереї не можна змінити, видалити чи додати', { skip: skip() }, () => {
    const a = account(true)
    const b = account(false)
    for (const write of [
      `update public.assets set focal_x = 0.1 where id = '${a.assetId}'`,
      `delete from public.assets where id = '${a.assetId}'`,
      `insert into public.assets (gallery_id, owner_id, r2_key, kind, content_type, size_bytes)
         values ('${a.galleryId}', '${b.userId}', 'x/' || gen_random_uuid(), 'photo', 'image/jpeg', 1)`,
    ]) {
      const r = pg!.trySql(`begin; set local role authenticated;
        select set_config('request.jwt.claim.sub', '${b.userId}', true); ${write}; commit;`)
      assert.ok(r.ok || /permission denied|row-level security/.test(r.out), r.out)
    }
    assert.equal(pg!.sql(`select count(*) || '|' || coalesce(max(focal_x)::text, 'null') from public.assets where gallery_id = '${a.galleryId}'`), '1|null')
  })
})

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return sourceFiles(path)
    return /\.tsx?$/.test(name) ? [path] : []
  })
}

describe('код кабінету: запити до galleries через клієнт користувача фільтрують за owner_id', () => {
  test('dashboard/page.tsx (список галерей) фільтрує за owner_id = user.id', () => {
    const page = readFileSync(join(ROOT, 'src/app/[locale]/dashboard/page.tsx'), 'utf8')
    const chain = page.slice(page.indexOf(".from('galleries')"), page.indexOf('.returns<Gallery[]>()'))
    assert.match(chain, /\.eq\('owner_id', user\.id\)/, 'список галерей у кабінеті без фільтра за власником')
  })

  test('жодного запиту до galleries у кабінеті без owner_id (крім admin-клієнта)', () => {
    const offenders: string[] = []
    for (const file of sourceFiles(join(ROOT, 'src/app/[locale]/dashboard'))) {
      const text = readFileSync(file, 'utf8')
      let at = text.indexOf(".from('galleries')")
      while (at !== -1) {
        const before = text.slice(Math.max(0, at - 40), at)
        const rest = text.slice(at)
        const end = rest.search(/\.returns<|\.single|\.maybeSingle|\n\s*\n|\),\n/)
        const chain = rest.slice(0, end === -1 ? 400 : end)
        const isAdmin = /admin\s*\n?\s*$/.test(before.trimEnd()) || /admin\s*$/.test(before)
        if (!isAdmin && !/\.eq\('owner_id',/.test(chain)) {
          const line = text.slice(0, at).split('\n').length
          offenders.push(`${relative(ROOT, file)}:${line}`)
        }
        at = text.indexOf(".from('galleries')", at + 1)
      }
    }
    assert.deepEqual(offenders, [], `запити без .eq('owner_id', …): ${offenders.join(', ')}`)
  })
})
