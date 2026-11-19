/**
 * Conteúdo (Studio) · repository: acesso a dados de content_items (S4).
 * Só consultas e chamadas de RPC; permissões ficam em service.ts e a validação
 * em schema.ts. O isolamento por workspace é garantido pela RLS e reforçado pelo
 * filtro organization_id em cada consulta.
 *
 * Imports relativos com `.ts` (e o cliente só como tipo): o arquivo é carregável
 * em `node --test`, porque as constantes de colunas e de cursor são testadas.
 */
import type { createClient } from "../supabase/server.ts";
import { applyKeyset, toPage, type KeysetSpec } from "../pagination/keyset.ts";
import { CONTENT_STATUSES, type ContentWrite } from "./schema.ts";
import type { ContentStatusApi } from "./types.ts";

export type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

export const CONTENT_SELECT_COLUMNS =
  "id,title,product,source_url,asset_url,script,caption,cta,hashtags,channels,rights_confirmed,media_asset_id,status,version,content_hash,approved_version,approved_at,created_at,updated_at";

/** Biblioteca do Studio: editado por último primeiro, id como desempate. Índice content_items_org_updated_id_idx (S16). */
export const CONTENT_KEYSET: KeysetSpec = {
  id: "content:v1",
  direction: "desc",
  keys: [
    { column: "updated_at", type: "timestamp" },
    { column: "id", type: "uuid" },
  ],
};

export type StatusCounts = { total: number; draft: number; approved: number; archived: number };

export function emptyCounts(): StatusCounts {
  return { total: 0, draft: 0, approved: 0, archived: 0 };
}

/** Uma página da biblioteca do workspace, opcionalmente filtrada por status. */
export async function listContentPage(
  supabase: SupabaseClient,
  organizationId: string,
  status: ContentStatusApi | null,
  after: readonly string[] | null,
  pageSize: number,
) {
  let query = supabase.from("content_items").select(CONTENT_SELECT_COLUMNS).eq("organization_id", organizationId);
  if (status) query = query.eq("status", status);
  const list = await applyKeyset(query, CONTENT_KEYSET, after, pageSize);
  if (list.error) throw list.error;
  return toPage(CONTENT_KEYSET, list.data ?? [], pageSize);
}

/** Contagem exata por status (index-only scan em content_items_org_status_idx), sob a RLS do usuário. */
export async function countByStatus(supabase: SupabaseClient, organizationId: string): Promise<StatusCounts> {
  const results = await Promise.all(
    CONTENT_STATUSES.map((value) =>
      supabase
        .from("content_items")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .eq("status", value),
    ),
  );
  const counts = emptyCounts();
  results.forEach((result, index) => {
    if (result.error) throw result.error;
    counts[CONTENT_STATUSES[index]] = result.count ?? 0;
  });
  counts.total = counts.draft + counts.approved + counts.archived;
  return counts;
}

export async function insertContent(
  supabase: SupabaseClient,
  organizationId: string,
  userId: string,
  row: ContentWrite,
) {
  const { data, error } = await supabase
    .from("content_items")
    .insert({ ...row, organization_id: organizationId, created_by: userId })
    .select(CONTENT_SELECT_COLUMNS)
    .single();
  if (error) throw error;
  return data;
}

/** null quando a peça não existe no workspace (ou a RLS a esconde). */
export async function updateContent(supabase: SupabaseClient, organizationId: string, contentId: string, row: ContentWrite) {
  const { data, error } = await supabase
    .from("content_items")
    .update(row)
    .eq("id", contentId)
    .eq("organization_id", organizationId)
    .select(CONTENT_SELECT_COLUMNS)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** Devolve o id excluído, ou null quando a peça não existe no workspace. */
export async function deleteContent(supabase: SupabaseClient, organizationId: string, contentId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("content_items")
    .delete()
    .eq("id", contentId)
    .eq("organization_id", organizationId)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  return data?.id ?? null;
}

/**
 * Aprovação humana da versão exata: o banco só aprova se o conteúdo atual tiver
 * exatamente o hash informado (public.approve_content) e confere o papel.
 * Depois relê a peça para devolver a versão aprovada.
 */
export async function approveContentVersion(supabase: SupabaseClient, contentId: string, expectedHash: string, note: string | undefined) {
  const { error } = await supabase.rpc("approve_content", {
    p_content_id: contentId,
    p_expected_hash: expectedHash,
    p_note: note,
  });
  if (error) throw error;

  const { data, error: readError } = await supabase.from("content_items").select(CONTENT_SELECT_COLUMNS).eq("id", contentId).single();
  if (readError) throw readError;
  return data;
}
