#!/usr/bin/env bash
# Referral-system test run against a throwaway local database.
#
# Brings up a local Postgres, applies supabase-stub.sql + every migration in
# supabase/migrations, puts PostgREST in front of it (so supabase-js and RLS
# behave as on Supabase), runs tests/referrals/*.test.ts, then tears it down.
#
# Needs: Postgres binaries (PG_BIN, default /usr/lib/postgresql/16/bin) and a
# PostgREST binary (POSTGREST_BIN, https://github.com/PostgREST/postgrest/releases).
# Never touches the production project.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PG_BIN="${PG_BIN:-/usr/lib/postgresql/16/bin}"
POSTGREST_BIN="${POSTGREST_BIN:-postgrest}"
WORK="${REF_TEST_WORK:-/var/tmp/proiav-ref-test}"
PG_PORT="${REF_TEST_PG_PORT:-54339}"
REST_PORT="${REF_TEST_REST_PORT:-54340}"
JWT_SECRET="referral-tests-only-secret-0123456789abcdef"

as_pg() {
  if [ "$(id -u)" = "0" ]; then su postgres -c "$*"; else bash -c "$*"; fi
}

rm -rf "$WORK" && mkdir -p "$WORK" && chmod 777 "$WORK"
as_pg "'$PG_BIN/initdb' -D '$WORK/data' -A trust -U postgres >/dev/null"
as_pg "'$PG_BIN/pg_ctl' -D '$WORK/data' -o \"-p $PG_PORT -k $WORK -c listen_addresses=127.0.0.1\" -l '$WORK/pg.log' -w start >/dev/null"

cleanup() {
  [ -n "${REST_PID:-}" ] && kill "$REST_PID" 2>/dev/null || true
  as_pg "'$PG_BIN/pg_ctl' -D '$WORK/data' -m fast stop >/dev/null" || true
}
trap cleanup EXIT

PSQL=(psql -h "$WORK" -p "$PG_PORT" -U postgres -v ON_ERROR_STOP=1 -q)
"${PSQL[@]}" -d postgres -c "create database app"
"${PSQL[@]}" -d app -f "$ROOT/tests/referrals/supabase-stub.sql" >/dev/null
for f in "$ROOT"/supabase/migrations/*.sql; do
  "${PSQL[@]}" -d app -f "$f" >/dev/null 2>"$WORK/mig.err" || {
    echo "migration failed: $f"; cat "$WORK/mig.err"; exit 1
  }
done
"${PSQL[@]}" -d app -c "notify pgrst, 'reload schema'"

PGRST_DB_URI="postgres://authenticator@127.0.0.1:$PG_PORT/app" \
PGRST_DB_SCHEMAS=public \
PGRST_DB_ANON_ROLE=anon \
PGRST_JWT_SECRET="$JWT_SECRET" \
PGRST_SERVER_PORT="$REST_PORT" \
  "$POSTGREST_BIN" >"$WORK/postgrest.log" 2>&1 &
REST_PID=$!
for _ in $(seq 1 50); do
  curl -sf "http://127.0.0.1:$REST_PORT/" >/dev/null 2>&1 && break
  sleep 0.2
done

export REF_TEST_PG="postgresql://postgres@127.0.0.1:$PG_PORT/app"
export REF_TEST_PSQL_HOST="$WORK" REF_TEST_PG_PORT="$PG_PORT"
export REF_TEST_REST="http://127.0.0.1:$REST_PORT"
export REF_TEST_JWT_SECRET="$JWT_SECRET"

cd "$ROOT"
node --experimental-test-module-mocks --no-warnings --import tsx \
  --test --test-concurrency=1 --test-reporter="${REF_TEST_REPORTER:-spec}" \
  tests/referrals/*.test.ts
