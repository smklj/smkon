#!/usr/bin/env bash
# Testes de banco do SMKON em um banco descartável. Nunca aponte para o Supabase hospedado.
#
# Modo "shim" (padrão): PostgreSQL comum (Docker ou CI). O script cria um banco
# temporário, aplica o shim do Supabase, todas as migrations e os testes, e apaga o banco.
#
#   docker run --rm -d --name smkon-pg -p 54329:5432 -e POSTGRES_PASSWORD=postgres postgres:17
#   DATABASE_ADMIN_URL=postgres://postgres:postgres@localhost:54329/postgres npm run test:db
#
# Modo "supabase": Supabase local já iniciado e migrado (supabase start && supabase db reset).
# O script só instala os helpers, roda os testes (cada arquivo em transação com rollback)
# e remove o schema de helpers.
#
#   DATABASE_URL=postgres://postgres:postgres@127.0.0.1:54322/postgres npm run test:db -- supabase

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MODE="${1:-shim}"
MIGRATIONS_DIR="$ROOT/supabase/migrations"
TESTS_DIR="$ROOT/supabase/tests"
SUPPORT_DIR="$TESTS_DIR/_support"

command -v psql >/dev/null || { echo "psql não encontrado no PATH." >&2; exit 2; }

# O Supabase CLI usa o prefixo numérico do arquivo como chave primária em
# supabase_migrations.schema_migrations: duas migrations com a mesma versão quebram
# `supabase db push`/`db reset`, mesmo que o SQL aplique aqui. Falha cedo.
DUPLICATE_VERSIONS="$(ls "$MIGRATIONS_DIR"/*.sql | xargs -n1 basename | sed -E 's/^([0-9]+)_.*/\1/' | sort | uniq -d)"
if [ -n "$DUPLICATE_VERSIONS" ]; then
  echo "Versões de migration duplicadas em supabase/migrations: $DUPLICATE_VERSIONS" >&2
  exit 1
fi

run_sql() {
  local url="$1" file="$2"
  echo "→ $(basename "$file")"
  psql "$url" -X -q -v ON_ERROR_STOP=1 -o /dev/null -f "$file"
}

run_tests() {
  local url="$1" count=0
  for test_file in "$TESTS_DIR"/*.test.sql; do
    run_sql "$url" "$test_file"
    count=$((count + 1))
  done
  echo "✓ $count arquivo(s) de teste passaram."
}

case "$MODE" in
  shim)
    ADMIN_URL="${DATABASE_ADMIN_URL:-postgres://postgres:postgres@localhost:5432/postgres}"
    case "$ADMIN_URL" in
      *supabase.co*|*supabase.com*) echo "Recusado: DATABASE_ADMIN_URL aponta para Supabase hospedado." >&2; exit 2 ;;
    esac
    DB="smkon_test_$(date +%s)_$$"
    # Troca o nome do banco na URL, preservando parâmetros (?host=...&port=...).
    URL_PATH="${ADMIN_URL%%\?*}"
    URL_QUERY="${ADMIN_URL#"$URL_PATH"}"
    TEST_URL="${URL_PATH%/*}/$DB$URL_QUERY"

    cleanup() { psql "$ADMIN_URL" -X -q -c "drop database if exists \"$DB\" with (force)" >/dev/null 2>&1 || true; }
    trap cleanup EXIT

    echo "Criando banco descartável $DB"
    psql "$ADMIN_URL" -X -q -v ON_ERROR_STOP=1 -c "create database \"$DB\""

    run_sql "$TEST_URL" "$SUPPORT_DIR/supabase_shim.sql"
    for migration in $(ls "$MIGRATIONS_DIR"/*.sql | sort); do
      run_sql "$TEST_URL" "$migration"
    done
    run_sql "$TEST_URL" "$SUPPORT_DIR/helpers.sql"
    run_tests "$TEST_URL"
    ;;

  supabase)
    URL="${DATABASE_URL:-postgres://postgres:postgres@127.0.0.1:54322/postgres}"
    case "$URL" in
      *supabase.co*|*supabase.com*) echo "Recusado: DATABASE_URL aponta para Supabase hospedado." >&2; exit 2 ;;
    esac
    cleanup() { psql "$URL" -X -q -c "drop schema if exists tests cascade" >/dev/null 2>&1 || true; }
    trap cleanup EXIT
    run_sql "$URL" "$SUPPORT_DIR/helpers.sql"
    run_tests "$URL"
    ;;

  *)
    echo "Uso: scripts/test-db.sh [shim|supabase]" >&2
    exit 2
    ;;
esac
