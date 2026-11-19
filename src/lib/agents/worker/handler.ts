/**
 * S14 etapa 6 — lógica HTTP do worker (/api/agents/worker), separada da rota para ser testada sem o Next.
 *
 * Ordem das barreiras (nenhuma tem efeito colateral antes de passar todas):
 * 1. AGENT_EXECUTOR_ENABLED !== "true"      → 503 executor_disabled
 * 2. CRON_SECRET ausente/curto               → 503 worker_not_configured
 * 3. Authorization ≠ "Bearer <CRON_SECRET>"  → 401 not_authenticated (comparação em tempo constante)
 * 4. modelo não configurado                  → 503 model_not_configured (nada é reservado)
 * 5. SUPABASE_SECRET_KEY ausente             → 503 service_not_configured
 * Só então o cliente service_role é criado e o disparo roda.
 */
import { log } from "../../observability/log.ts";
import { jsonError } from "../../http/errors.ts";
import { modelConfigStatus, resolveAgentModel } from "../executor/model.ts";
import type { AgentRpcClient } from "../executor/rpc.ts";
import { rpcAgentStore } from "../executor/store.ts";
import { postgrestToolDb, type PostgrestLike } from "../executor/tools/db.ts";
import { createDraftTool } from "../executor/tools/draft.ts";
import { createReadTools } from "../executor/tools/read.ts";
import type { AgentModel, ToolRegistry } from "../executor/types.ts";
import type { ExecutorLogger } from "../executor/run.ts";
import { bearerMatches, cronSecret, executorEnabled, type WorkerEnv } from "./auth.ts";
import { rpcWorkerQueue } from "./queue.ts";
import { runWorkerTick, type WorkerTickDeps } from "./tick.ts";

export type WorkerDbClient = AgentRpcClient & PostgrestLike;

export interface WorkerHandlerDeps {
  env: WorkerEnv;
  /** Cria o cliente service_role; null se a chave não estiver configurada. */
  createClient: () => WorkerDbClient | null;
  resolveModel?: (env: WorkerEnv) => AgentModel | null;
  logger?: ExecutorLogger;
  tick?: Pick<WorkerTickDeps, "maxRuns" | "budgetMs" | "leaseSeconds" | "now" | "execute">;
}

const SCOPE = "api.agents.worker";
const NO_STORE = { "Cache-Control": "no-store" };

function withNoStore(response: Response): Response {
  response.headers.set("Cache-Control", NO_STORE["Cache-Control"]);
  return response;
}

export function workerTools(client: WorkerDbClient): ToolRegistry {
  return { ...createReadTools(postgrestToolDb(client)), draft_content: createDraftTool(client) };
}

export async function handleWorkerRequest(request: Request, deps: WorkerHandlerDeps): Promise<Response> {
  const logger = deps.logger ?? log;

  if (!executorEnabled(deps.env)) {
    return withNoStore(jsonError(503, "executor_disabled", "Executor de agentes desligado."));
  }
  const secret = cronSecret(deps.env);
  if (!secret) {
    logger("error", SCOPE, { event: "worker_not_configured" });
    return withNoStore(jsonError(503, "worker_not_configured", "Worker sem segredo configurado."));
  }
  if (!bearerMatches(request.headers.get("authorization"), secret)) {
    logger("warn", SCOPE, { event: "unauthorized" });
    return withNoStore(jsonError(401, "not_authenticated", "Não autenticado."));
  }
  const model = (deps.resolveModel ?? resolveAgentModel)(deps.env);
  if (!model) {
    const status = modelConfigStatus(deps.env);
    // Só o motivo (provider_missing, key_missing…), nunca valores das variáveis.
    logger("warn", SCOPE, { event: "model_not_configured", reason: status.ok ? "resolver_returned_null" : status.reason });
    return withNoStore(jsonError(503, "model_not_configured", "Nenhum modelo de IA configurado."));
  }
  const client = deps.createClient();
  if (!client) {
    logger("error", SCOPE, { event: "service_not_configured" });
    return withNoStore(jsonError(503, "service_not_configured", "Worker sem acesso de serviço ao banco."));
  }

  try {
    const result = await runWorkerTick({
      ...deps.tick,
      queue: rpcWorkerQueue(client),
      store: rpcAgentStore(client),
      model,
      tools: workerTools(client),
      logger,
    });
    if (result.status === "model_not_configured") {
      return withNoStore(jsonError(503, "model_not_configured", "Nenhum modelo de IA configurado."));
    }
    // Só identificadores e códigos: nada de objetivo, saídas de ferramenta ou dados de produto.
    return Response.json(
      { reaped: result.reaped, stoppedBy: result.stoppedBy, runs: result.runs },
      { status: 200, headers: NO_STORE },
    );
  } catch (error) {
    logger("error", SCOPE, { event: "tick_error", message: String((error as Error)?.message ?? error) });
    return withNoStore(jsonError(500, "internal_error", "Falha no disparo do worker."));
  }
}
