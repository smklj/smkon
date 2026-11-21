/**
 * S16 — paginação por cursor da lista de execuções de /agentes.
 * Mais recentes primeiro, desempate por id (created_at tem empates).
 * Índice: o existente agent_runs_org_created_idx (organization_id, created_at desc) serve —
 * medido em docs/S16_PROGRESS.md (18 mil execuções no workspace): 1ª página e página funda
 * em < 0,1 ms com Incremental Sort só nos empates. Por isso não há índice novo.
 */
import type { KeysetSpec } from "../pagination/keyset.ts";

export const AGENT_RUNS_KEYSET: KeysetSpec = {
  id: "agent_runs",
  direction: "desc",
  keys: [
    { column: "created_at", type: "timestamp" },
    { column: "id", type: "uuid" },
  ],
};

/** Mesmo tamanho da lista anterior ("últimas 20"): cada execução carrega seus passos. */
export const AGENT_RUNS_PAGE_SIZE = 20;
