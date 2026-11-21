#!/usr/bin/env bash
# S16 · Cria (ou recria) um banco local de benchmark com todas as migrations e dados sintéticos.
# SOMENTE Postgres local descartável. Recusa URLs do Supabase hospedado.
#
#   DATABASE_ADMIN_URL='postgresql://postgres@/postgres?host=/tmp/pg&port=54329' bash scripts/perf/bench-db.sh
#   BENCH_BEFORE=20261119120000 ... (estado anterior às migrations do S16)
#   psql "<url do smkon_bench>" -f scripts/perf/explain-screens.sql
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ADMIN_URL="${DATABASE_ADMIN_URL:-postgres://postgres:postgres@localhost:5432/postgres}"
DB="${BENCH_DB:-smkon_bench}"
case "$ADMIN_URL" in
  *supabase.co*|*supabase.com*) echo "Recusado: DATABASE_ADMIN_URL aponta para Supabase hospedado." >&2; exit 2 ;;
esac
URL_PATH="${ADMIN_URL%%\?*}"
URL_QUERY="${ADMIN_URL#"$URL_PATH"}"
BENCH_URL="${URL_PATH%/*}/$DB$URL_QUERY"

psql "$ADMIN_URL" -X -q -v ON_ERROR_STOP=1 -c "drop database if exists \"$DB\" with (force)" -c "create database \"$DB\""
# Mesmos parâmetros do planejador do Supabase (conferidos no staging em 19/11/2026: PG 17,
# jit off, random_page_cost 1.1, work_mem 2184 kB). Sem isso o Postgres local liga o JIT em
# consultas de custo alto e mede um tempo que não existe no Supabase.
psql "$ADMIN_URL" -X -q -v ON_ERROR_STOP=1 \
  -c "alter database \"$DB\" set jit = off" \
  -c "alter database \"$DB\" set random_page_cost = 1.1" \
  -c "alter database \"$DB\" set work_mem = '2184kB'"
psql "$BENCH_URL" -X -q -v ON_ERROR_STOP=1 -o /dev/null -f "$ROOT/supabase/tests/_support/supabase_shim.sql" 2>/dev/null
# BENCH_BEFORE=<versão> aplica só as migrations anteriores a ela (medição "antes").
BEFORE="${BENCH_BEFORE:-99999999999999}"
for migration in $(ls "$ROOT"/supabase/migrations/*.sql | sort); do
  version="$(basename "$migration" | cut -d_ -f1)"
  [ "$version" \< "$BEFORE" ] || continue
  psql "$BENCH_URL" -X -q -v ON_ERROR_STOP=1 -o /dev/null -f "$migration" 2>/dev/null
done
psql "$BENCH_URL" -X -q -v ON_ERROR_STOP=1 -f "$ROOT/scripts/perf/seed-bench.sql"
echo "Banco de benchmark pronto: $BENCH_URL"
