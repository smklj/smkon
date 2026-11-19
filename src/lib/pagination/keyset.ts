/**
 * S16 — paginação por cursor (keyset) para listas servidas pelo PostgREST.
 *
 * Por que keyset e não offset: o custo de uma página com OFFSET cresce com a
 * profundidade (o banco lê e descarta todas as linhas anteriores), e linhas
 * inseridas entre duas leituras deslocam a página. O cursor guarda os valores
 * da última linha vista e a próxima página começa estritamente depois dela.
 *
 * Regras:
 * - A ordenação é estável: a última chave é sempre única (id), então não há
 *   empate entre linhas e nada aparece duas vezes nem some entre páginas.
 * - Todas as chaves usam a mesma direção, para casar com um índice composto.
 * - Chaves não podem ser nulas (para coluna anulável, use uma coluna gerada
 *   sem NULL, como products.score_rank).
 * - O filtro tem duas partes: um limite inicial na primeira chave (`lte`/`gte`),
 *   que o Postgres usa como condição de índice, e a comparação lexicográfica
 *   completa em `or(...)`, que decide os empates.
 * - Os valores do cursor vêm do cliente: são validados por tipo com expressões
 *   estritas antes de entrar no filtro, então não carregam vírgula, aspas nem
 *   parênteses que alterariam a sintaxe do PostgREST.
 * - Timestamps são mantidos como texto exatamente como o PostgREST devolve
 *   (microssegundos); converter para Date perderia precisão e repetiria linhas.
 */
import { ValidationError } from "../http/errors.ts";

export type KeyType = "timestamp" | "uuid" | "integer";
export type SortKey = { readonly column: string; readonly type: KeyType };
export type KeysetSpec = {
  /** Identifica a lista; cursor de outra lista é recusado. */
  readonly id: string;
  readonly direction: "asc" | "desc";
  /** Da mais significativa para a de desempate; a última precisa ser única. */
  readonly keys: readonly SortKey[];
};

export const DEFAULT_PAGE_SIZE = 50;
export const MAX_PAGE_SIZE = 100;

export class InvalidCursorError extends ValidationError {
  constructor() {
    super("Cursor de paginação inválido. Volte para a primeira página.");
    this.name = "InvalidCursorError";
  }
}

const VALUE_PATTERN: Record<KeyType, RegExp> = {
  timestamp: /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|[+-]\d{2}(:?\d{2})?)$/,
  uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  integer: /^-?\d{1,15}$/,
};
const COLUMN_PATTERN = /^[a-z_][a-z0-9_]*$/;

function assertSpec(spec: KeysetSpec) {
  if (spec.keys.length < 2) throw new Error(`keyset ${spec.id}: use ao menos uma chave e o desempate único`);
  for (const key of spec.keys) {
    if (!COLUMN_PATTERN.test(key.column)) throw new Error(`keyset ${spec.id}: coluna inválida ${key.column}`);
  }
}

/** Valor canônico da chave, ou null se não for válido para o tipo. */
export function normalizeKeyValue(type: KeyType, value: unknown): string | null {
  let text: string;
  if (typeof value === "number") {
    if (type !== "integer" || !Number.isSafeInteger(value)) return null;
    text = String(value);
  } else if (typeof value === "string") {
    text = value;
  } else {
    return null;
  }
  if (!VALUE_PATTERN[type].test(text)) return null;
  return type === "uuid" ? text.toLowerCase() : text;
}

/** Tamanho de página vindo de query string: inteiro entre 1 e MAX_PAGE_SIZE. */
export function parsePageSize(raw: string | null | undefined, fallback = DEFAULT_PAGE_SIZE): number {
  if (raw === null || raw === undefined || raw === "") return fallback;
  if (!/^\d{1,4}$/.test(raw)) return fallback;
  const size = Number(raw);
  if (size < 1) return fallback;
  return Math.min(size, MAX_PAGE_SIZE);
}

function toBase64Url(text: string): string {
  return btoa(text).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(raw: string): string {
  const base64 = raw.replace(/-/g, "+").replace(/_/g, "/");
  return atob(base64 + "=".repeat((4 - (base64.length % 4)) % 4));
}

export function encodeCursor(spec: KeysetSpec, values: readonly unknown[]): string {
  assertSpec(spec);
  if (values.length !== spec.keys.length) throw new Error(`keyset ${spec.id}: número de valores diferente das chaves`);
  const normalized = spec.keys.map((key, index) => {
    const value = normalizeKeyValue(key.type, values[index]);
    if (value === null) throw new Error(`keyset ${spec.id}: valor inválido para ${key.column}`);
    return value;
  });
  return toBase64Url(JSON.stringify({ l: spec.id, v: normalized }));
}

/** null quando não há cursor (primeira página); InvalidCursorError quando o cursor não serve. */
export function decodeCursor(spec: KeysetSpec, raw: string | null | undefined): string[] | null {
  if (raw === null || raw === undefined || raw === "") return null;
  if (raw.length > 512 || !/^[A-Za-z0-9_-]+$/.test(raw)) throw new InvalidCursorError();
  let parsed: unknown;
  try {
    parsed = JSON.parse(fromBase64Url(raw));
  } catch {
    throw new InvalidCursorError();
  }
  if (!parsed || typeof parsed !== "object") throw new InvalidCursorError();
  const { l, v } = parsed as { l?: unknown; v?: unknown };
  if (l !== spec.id || !Array.isArray(v) || v.length !== spec.keys.length) throw new InvalidCursorError();
  return spec.keys.map((key, index) => {
    const value = normalizeKeyValue(key.type, v[index]);
    if (value === null) throw new InvalidCursorError();
    return value;
  });
}

/**
 * Filtro "depois do cursor" em sintaxe PostgREST.
 * desc, chaves (a, b, id) e cursor (x, y, z):
 *   a <= x  e  (a < x  ou  (a = x e b < y)  ou  (a = x e b = y e id < z))
 */
export function keysetFilter(spec: KeysetSpec, values: readonly string[]) {
  assertSpec(spec);
  if (values.length !== spec.keys.length) throw new InvalidCursorError();
  const strict = spec.direction === "desc" ? "lt" : "gt";
  const quoted = values.map((value) => `"${value}"`);
  const branches = spec.keys.map((key, index) => {
    const equals = spec.keys.slice(0, index).map((previous, j) => `${previous.column}.eq.${quoted[j]}`);
    const terms = [...equals, `${key.column}.${strict}.${quoted[index]}`];
    return terms.length === 1 ? terms[0] : `and(${terms.join(",")})`;
  });
  return {
    bound: { column: spec.keys[0].column, operator: spec.direction === "desc" ? ("lte" as const) : ("gte" as const), value: values[0] },
    or: branches.join(","),
  };
}

/** O mínimo do query builder do supabase-js usado aqui (facilita testar sem rede). */
export interface KeysetQuery<Q> {
  order(column: string, options: { ascending: boolean }): Q;
  lte(column: string, value: string): Q;
  gte(column: string, value: string): Q;
  or(filters: string): Q;
  limit(count: number): Q;
}

/** Aplica ordenação estável, filtro do cursor e limite (+1 para saber se há próxima página). */
export function applyKeyset<Q extends KeysetQuery<Q>>(query: Q, spec: KeysetSpec, cursor: readonly string[] | null, pageSize: number): Q {
  assertSpec(spec);
  let next = query;
  if (cursor) {
    const filter = keysetFilter(spec, cursor);
    next = filter.bound.operator === "lte" ? next.lte(filter.bound.column, filter.bound.value) : next.gte(filter.bound.column, filter.bound.value);
    next = next.or(filter.or);
  }
  for (const key of spec.keys) next = next.order(key.column, { ascending: spec.direction === "asc" });
  return next.limit(pageSize + 1);
}

export type Page<T> = { items: T[]; nextCursor: string | null };

/** Corta a linha extra e gera o cursor da próxima página a partir da última linha exibida. */
export function toPage<T extends object>(spec: KeysetSpec, rows: readonly T[], pageSize: number): Page<T> {
  const items = rows.slice(0, pageSize);
  if (rows.length <= pageSize || items.length === 0) return { items, nextCursor: null };
  const last = items[items.length - 1] as Record<string, unknown>;
  return { items, nextCursor: encodeCursor(spec, spec.keys.map((key) => last[key.column])) };
}
