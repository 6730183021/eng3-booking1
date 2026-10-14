#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# Runs the migrations + booking tests + a real concurrency race on a throw-away
# local PostgreSQL (15+) — no Supabase/Docker needed.
#   usage:  bash supabase/tests/run-local-tests.sh
#   needs:  initdb, pg_ctl, psql on PATH (or PG_BIN=/usr/lib/postgresql/16/bin)
# -----------------------------------------------------------------------------
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
PG_BIN="${PG_BIN:-$(dirname "$(command -v pg_ctl || echo /usr/lib/postgresql/16/bin/pg_ctl)")}"
WORK="$(mktemp -d)"
PORT="${PORT:-54329}"
RACERS="${RACERS:-40}"
export PGHOST="$WORK" PGPORT="$PORT" PGUSER="${PGUSER:-$(whoami)}" PGDATABASE=eng3_test

cleanup() { "$PG_BIN/pg_ctl" -D "$WORK/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$WORK"; }
trap cleanup EXIT

"$PG_BIN/initdb" -D "$WORK/data" -U "$PGUSER" --auth=trust >/dev/null
"$PG_BIN/pg_ctl" -D "$WORK/data" -o "-k $WORK -p $PORT -c listen_addresses='' -c max_connections=200 -c timezone=UTC" -l "$WORK/pg.log" start >/dev/null
"$PG_BIN/createdb" eng3_test

PSQL=(psql -X -q -v ON_ERROR_STOP=1)
echo "▶ migrations"
"${PSQL[@]}" -f "$HERE/00_local_auth_stub.sql"
for f in "$ROOT"/supabase/migrations/*.sql; do
  case "$f" in *_cron.sql) continue;; esac       # pg_cron is not available locally
  "${PSQL[@]}" -f "$f"
done
"${PSQL[@]}" -f "$ROOT/supabase/seed.sql"

echo "▶ booking flow"
"${PSQL[@]}" -o /dev/null -f "$HERE/10_booking_flow.sql" 2>&1 | sed 's/^psql:[^ ]* NOTICE:  /  /'

echo "▶ concurrency race: $RACERS students click 'จอง' on the same room/time at the same instant"
"${PSQL[@]}" <<SQL
insert into auth.users (id, email)
select gen_random_uuid(), format('66%s21@student.chula.ac.th', lpad(i::text, 6, '0'))
from generate_series(1, $RACERS) i;
update public.profiles set full_name = 'Racer', department = 'IE', year_of_study = 1, phone = '0800000000', privacy_accepted_at = now()
where email like '66%';
SQL
DAY=$("${PSQL[@]}" -At -c "select d from generate_series((now() at time zone 'Asia/Bangkok')::date + 2, (now() at time zone 'Asia/Bangkok')::date + 9, interval '1 day') g(d) where extract(isodow from d) <= 6 limit 1")
ROOM=$("${PSQL[@]}" -At -c "select id from public.rooms where code = '3-305'")
mapfile -t UIDS < <("${PSQL[@]}" -At -c "select id from public.profiles where email like '66%' order by email")

GO="$WORK/go"; : > "$WORK/results"
for i in "${!UIDS[@]}"; do
  uid="${UIDS[$i]}"
  # half of the racers ask for 15:00–17:00, the other half for an overlapping 16:00–18:00
  if (( i % 2 )); then S="15:00"; E="17:00"; else S="16:00"; E="18:00"; fi
  (
    while [ ! -f "$GO" ]; do sleep 0.01; done
    out=$(psql -X -At -v ON_ERROR_STOP=1 2>&1 <<SQL || true
set role authenticated;
select set_config('request.jwt.claim.sub', '$uid', false) \\g /dev/null
select 'OK' from public.hold_slot('$ROOM', ('$DAY'::date + time '$S') at time zone 'Asia/Bangkok', ('$DAY'::date + time '$E') at time zone 'Asia/Bangkok');
SQL
)
    case "$out" in
      *OK*) echo OK ;; *SLOT_LOCKED*) echo SLOT_LOCKED ;; *SLOT_TAKEN*) echo SLOT_TAKEN ;; *) echo "UNEXPECTED: $out" ;;
    esac >> "$WORK/results"
  ) &
done
sleep 1; touch "$GO"; wait

sort "$WORK/results" | uniq -c | sed 's/^/   /'
OK=$(grep -c '^OK$' "$WORK/results" || true)
LIVE=$("${PSQL[@]}" -At -c "select count(*) from public.bookings where room_id = '$ROOM' and status = 'holding'")
if [[ "$OK" == "1" && "$LIVE" == "1" ]] && ! grep -q UNEXPECTED "$WORK/results"; then
  echo "  PASS  exactly one winner, everyone else was told the slot is locked"
else
  echo "  FAIL  winners=$OK live_holds=$LIVE"; exit 1
fi
echo "✔ all database tests passed"
