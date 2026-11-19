/**
 * S14 etapa 6 — subconjunto estrutural do cliente Supabase usado pelo executor no servidor.
 *
 * O cliente real (service_role) só existe na rota do worker. Aqui fica apenas a forma mínima que o store, a
 * fila e o draft_content usam, para que os testes rodem com um cliente falso e sem dependências. O cliente
 * tipado do supabase-js não é atribuível diretamente a estas interfaces (TS2589, tipo profundo demais); a
 * conversão explícita acontece só na rota.
 */

export interface DbErrorLike {
  message: string;
  code?: string;
}

export interface DbResult<T = unknown> {
  data: T;
  error: DbErrorLike | null;
}

export interface RpcCall extends PromiseLike<DbResult> {
  abortSignal(signal: AbortSignal): PromiseLike<DbResult>;
}

export interface AgentRpcClient {
  rpc(fn: string, args?: Record<string, unknown>): RpcCall;
  from(table: string): {
    select(columns: string): {
      eq(column: string, value: string): { maybeSingle(): PromiseLike<DbResult> };
    };
  };
}

/**
 * Erro vindo do banco com a mensagem reduzida ao código de negócio (`raise exception '<code>'`).
 * runAgent lê `message` para reconhecer run_not_active / verification_required.
 */
export class AgentDbError extends Error {
  readonly code: string | undefined;
  constructor(message: string, code?: string) {
    super(message);
    this.name = "AgentDbError";
    this.code = code;
  }
}

/** Primeira linha de um RPC `returns table` (o PostgREST devolve array). */
export function firstRow(data: unknown): Record<string, unknown> | null {
  const row = Array.isArray(data) ? data[0] : data;
  return row && typeof row === "object" && !Array.isArray(row) ? (row as Record<string, unknown>) : null;
}

export function toDbError(error: DbErrorLike): AgentDbError {
  return new AgentDbError(String(error.message ?? "").trim() || "db_error", error.code);
}
