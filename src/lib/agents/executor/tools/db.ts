/**
 * S14 etapa 3 — porta de leitura das ferramentas dos agentes.
 *
 * As ferramentas descrevem a consulta de forma declarativa (tabela, colunas, filtros, ordem, limite) e a porta
 * executa. O filtro de organização NÃO é um filtro comum: é um argumento obrigatório separado que o adaptador
 * aplica sempre, antes de qualquer outro. Assim nenhuma ferramenta consegue "esquecer" o isolamento multi-tenant,
 * e o modelo nunca escolhe a organização (ela vem de RunContext.organizationId, que vem do banco).
 *
 * Em produção o executor roda com service_role (sem RLS), então este filtro é a única barreira de tenant
 * nas leituras — por isso ele é testado aqui e não depende de cada ferramenta.
 */

/** Tabelas/visões que as ferramentas de leitura podem consultar. Nada fora desta lista. */
export const READ_TABLES = [
  "products",
  "product_evidence",
  "content_items",
  "publication_jobs",
  "affiliate_commission_summary",
  "sales_orders",
  "ad_campaign_daily_metrics",
] as const;
export type ReadTable = (typeof READ_TABLES)[number];

export type FilterValue = string | number | boolean;

export type Filter =
  | { op: "eq" | "neq" | "gte" | "lt"; column: string; value: FilterValue }
  | { op: "in"; column: string; value: readonly FilterValue[] };

export interface OrderBy {
  column: string;
  ascending: boolean;
  nullsFirst?: boolean;
}

export interface ReadQuery {
  table: ReadTable;
  /** Sempre aplicado como organization_id = organizationId. Obrigatório. */
  organizationId: string;
  columns: readonly string[];
  filters?: readonly Filter[];
  order?: readonly OrderBy[];
  /** Limite de linhas (1..10000). */
  limit: number;
}

export type Row = Record<string, unknown>;

export interface ToolDb {
  select(query: ReadQuery, signal: AbortSignal): Promise<Row[]>;
}

export class ToolDbError extends Error {
  readonly code: string;
  constructor(message: string, code = "tool_db_error") {
    super(message);
    this.name = "ToolDbError";
    this.code = code;
  }
}

const IDENTIFIER = /^[a-z_][a-z0-9_]{0,62}$/;
export const MAX_QUERY_ROWS = 10_000;

/** Valida a consulta antes de qualquer acesso ao banco. Lança ToolDbError. */
export function assertReadQuery(query: ReadQuery): void {
  if (!(READ_TABLES as readonly string[]).includes(query.table)) throw new ToolDbError(`table_not_allowed: ${query.table}`);
  if (typeof query.organizationId !== "string" || query.organizationId.trim() === "") {
    throw new ToolDbError("organization_required");
  }
  if (query.columns.length === 0) throw new ToolDbError("columns_required");
  for (const column of query.columns) {
    if (!IDENTIFIER.test(column)) throw new ToolDbError(`invalid_column: ${column}`);
  }
  for (const filter of query.filters ?? []) {
    if (!IDENTIFIER.test(filter.column)) throw new ToolDbError(`invalid_column: ${filter.column}`);
    if (filter.column === "organization_id") throw new ToolDbError("organization_filter_is_implicit");
  }
  for (const order of query.order ?? []) {
    if (!IDENTIFIER.test(order.column)) throw new ToolDbError(`invalid_column: ${order.column}`);
  }
  if (!Number.isInteger(query.limit) || query.limit < 1 || query.limit > MAX_QUERY_ROWS) {
    throw new ToolDbError(`invalid_limit: ${query.limit}`);
  }
}

/**
 * Subconjunto estrutural do query builder do supabase-js (PostgREST) usado pelo adaptador.
 * Mantido mínimo para os testes usarem um builder falso sem dependências.
 */
export interface PostgrestFilterLike extends PromiseLike<{ data: unknown; error: { message: string; code?: string } | null }> {
  eq(column: string, value: FilterValue): PostgrestFilterLike;
  neq(column: string, value: FilterValue): PostgrestFilterLike;
  gte(column: string, value: FilterValue): PostgrestFilterLike;
  lt(column: string, value: FilterValue): PostgrestFilterLike;
  in(column: string, values: readonly FilterValue[]): PostgrestFilterLike;
  order(column: string, options: { ascending: boolean; nullsFirst?: boolean }): PostgrestFilterLike;
  limit(count: number): PostgrestFilterLike;
  abortSignal(signal: AbortSignal): PostgrestFilterLike;
}

export interface PostgrestLike {
  from(table: string): { select(columns: string): PostgrestFilterLike };
}

/** Adaptador da porta sobre o cliente Supabase (service_role, só no servidor — ligado no worker, etapa 6). */
export function postgrestToolDb(client: PostgrestLike): ToolDb {
  return {
    async select(query, signal) {
      assertReadQuery(query);
      let builder = client.from(query.table).select(query.columns.join(",")).eq("organization_id", query.organizationId);
      for (const filter of query.filters ?? []) {
        builder = filter.op === "in" ? builder.in(filter.column, filter.value) : builder[filter.op](filter.column, filter.value);
      }
      for (const order of query.order ?? []) {
        builder = builder.order(order.column, order.nullsFirst === undefined
          ? { ascending: order.ascending }
          : { ascending: order.ascending, nullsFirst: order.nullsFirst });
      }
      builder = builder.limit(query.limit).abortSignal(signal);
      const { data, error } = await builder;
      if (error) throw new ToolDbError(`query_failed: ${query.table}`, error.code ?? "tool_db_error");
      if (data === null || data === undefined) return [];
      if (!Array.isArray(data)) throw new ToolDbError(`unexpected_shape: ${query.table}`);
      return data.filter((row): row is Row => row !== null && typeof row === "object" && !Array.isArray(row));
    },
  };
}
