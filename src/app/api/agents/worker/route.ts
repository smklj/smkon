/**
 * S14 etapa 6 — worker do executor de agentes (Planner → Executor → Verifier).
 *
 * Disparado por Vercel Cron (GET com Authorization: Bearer CRON_SECRET). Desligado por padrão:
 * sem AGENT_EXECUTOR_ENABLED=true responde 503 sem efeito. Toda a lógica e as barreiras estão em
 * src/lib/agents/worker/handler.ts. O cron e as variáveis NÃO são configurados por este código —
 * ver docs/S14_PROGRESS.md (autorizações do Owner).
 */
import { handleWorkerRequest, type WorkerDbClient } from "@/lib/agents/worker/handler";
import { createServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Abaixo do lease de 600 s de agent_reap_stale_runs: execução cortada pela plataforma expira no disparo seguinte.
export const maxDuration = 300;

export async function GET(request: Request) {
  return handleWorkerRequest(request, {
    env: process.env,
    // O cliente tipado do supabase-js não é atribuível às interfaces estruturais mínimas (TS2589);
    // a conversão explícita fica só aqui.
    createClient: () => createServiceClient() as unknown as WorkerDbClient | null,
  });
}
