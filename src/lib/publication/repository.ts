/**
 * Publicação (calendário em dry-run) · repository: acesso a dados (S4).
 * Só consultas e RPCs; permissões em service.ts e validação em schema.ts.
 * schedule_publication, run_publication_dry_run e cancel_publication conferem no
 * banco a versão aprovada, o papel e o workspace. Nada aqui publica em rede social.
 */
import type { createClient } from "@/lib/supabase/server";
import { toChecks, type PublicationChannel, type PublicationJobRow, type PublicationStatus } from "./types";

export type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

export type ApprovedContent = { id: string; title: string; version: number; channels: string[] };

export async function listApprovedContent(supabase: SupabaseClient, organizationId: string): Promise<ApprovedContent[]> {
  const { data, error } = await supabase
    .from("content_items")
    .select("id,title,version,channels")
    .eq("organization_id", organizationId)
    .eq("status", "approved")
    .order("updated_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data ?? []).map((row) => ({ id: row.id, title: row.title, version: row.version, channels: row.channels }));
}

/** Fila do período, com o título da peça. */
export async function listPublicationJobs(
  supabase: SupabaseClient,
  organizationId: string,
  fromIso: string,
  toIso: string,
): Promise<PublicationJobRow[]> {
  const { data, error } = await supabase
    .from("publication_jobs")
    .select("id,content_item_id,content_version,channel,scheduled_for,status,checks,last_run_at,cancel_reason")
    .eq("organization_id", organizationId)
    .gte("scheduled_for", fromIso)
    .lt("scheduled_for", toIso)
    .order("scheduled_for", { ascending: true })
    .limit(300);
  if (error) throw error;
  const rows = data ?? [];
  const ids = [...new Set(rows.map((row) => row.content_item_id))];
  const titles = new Map<string, string>();
  if (ids.length) {
    const items = await supabase.from("content_items").select("id,title").in("id", ids);
    if (items.error) throw items.error;
    for (const item of items.data ?? []) titles.set(item.id, item.title);
  }
  return rows.map((row) => ({
    id: row.id,
    content_item_id: row.content_item_id,
    content_version: row.content_version,
    channel: row.channel as PublicationChannel,
    scheduled_for: row.scheduled_for,
    status: row.status as PublicationStatus,
    checks: toChecks(row.checks),
    last_run_at: row.last_run_at,
    cancel_reason: row.cancel_reason,
    content_title: titles.get(row.content_item_id) ?? "Conteúdo",
  }));
}

export async function schedulePublication(supabase: SupabaseClient, contentId: string, channel: PublicationChannel, scheduledFor: string) {
  const { data, error } = await supabase.rpc("schedule_publication", {
    p_content_id: contentId,
    p_channel: channel,
    p_scheduled_for: scheduledFor,
  });
  if (error) throw error;
  return data as string;
}

export async function runDryRun(supabase: SupabaseClient, jobId: string): Promise<PublicationStatus> {
  const { data, error } = await supabase.rpc("run_publication_dry_run", { p_job_id: jobId });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return row?.job_status as PublicationStatus;
}

export async function cancelPublication(supabase: SupabaseClient, jobId: string, reason: string) {
  const { error } = await supabase.rpc("cancel_publication", { p_job_id: jobId, p_reason: reason });
  if (error) throw error;
}
