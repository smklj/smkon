/**
 * Mídia e licenças · repository: acesso a dados (Supabase e Storage) da biblioteca (S4).
 * Só consultas, inserts e RPCs; permissões ficam em service.ts e a validação em
 * schema.ts. O isolamento por workspace é garantido pela RLS e reforçado pelo
 * filtro organization_id nas consultas e inserts.
 */
import { applyKeyset, decodeCursor, DEFAULT_PAGE_SIZE, toPage, type KeysetSpec, type Page } from "@/lib/pagination/keyset";
import type { createClient } from "@/lib/supabase/server";
import { MEDIA_BUCKET, type LicenseRow, type MediaRow } from "./types";
import type { LicenseInput } from "./schema";

export type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

const MEDIA_COLUMNS = "id,storage_path,kind,mime_type,size_bytes,original_name,created_at,archived_at";
const LICENSE_COLUMNS =
  "id,media_asset_id,license_type,licensor,proof_url,allows_commercial_use,allows_modification,territory,valid_from,valid_until,notes,created_at,revoked_at,revoke_reason";

export type MediaWithLicenses = MediaRow & { licenses: LicenseRow[]; signedUrl: string | null };

/** Biblioteca: envio mais recente primeiro, id como desempate. Índice media_assets_org_created_id_idx (S16). */
export const MEDIA_KEYSET: KeysetSpec = {
  id: "media:v1",
  direction: "desc",
  keys: [
    { column: "created_at", type: "timestamp" },
    { column: "id", type: "uuid" },
  ],
};

export type ListMediaOptions = { includeArchived?: boolean; signUrls?: boolean; cursor?: string | null; pageSize?: number };

/** Uma página da biblioteca com as licenças de cada arquivo. Cursor inválido lança InvalidCursorError. */
export async function listMedia(
  supabase: SupabaseClient,
  organizationId: string,
  { includeArchived = false, signUrls = false, cursor = null, pageSize = DEFAULT_PAGE_SIZE }: ListMediaOptions = {},
): Promise<Page<MediaWithLicenses>> {
  const after = decodeCursor(MEDIA_KEYSET, cursor);
  let query = supabase.from("media_assets").select(MEDIA_COLUMNS).eq("organization_id", organizationId);
  if (!includeArchived) query = query.is("archived_at", null);
  const { data, error } = await applyKeyset(query, MEDIA_KEYSET, after, pageSize);
  if (error) throw error;
  const page = toPage(MEDIA_KEYSET, (data ?? []) as MediaRow[], pageSize);
  const assets = page.items;
  if (assets.length === 0) return { items: [], nextCursor: null };

  const licenses = await supabase
    .from("media_licenses")
    .select(LICENSE_COLUMNS)
    .in("media_asset_id", assets.map((asset) => asset.id))
    .order("created_at", { ascending: false });
  if (licenses.error) throw licenses.error;
  const byAsset = new Map<string, LicenseRow[]>();
  for (const license of (licenses.data ?? []) as LicenseRow[]) {
    byAsset.set(license.media_asset_id, [...(byAsset.get(license.media_asset_id) ?? []), license]);
  }

  // URLs assinadas de curta duração: o bucket é privado.
  const signed = new Map<string, string>();
  if (signUrls) {
    const result = await supabase.storage.from(MEDIA_BUCKET).createSignedUrls(assets.map((asset) => asset.storage_path), 600);
    if (result.error) throw result.error;
    for (const item of result.data ?? []) {
      if (item.path && item.signedUrl) signed.set(item.path, item.signedUrl);
    }
  }

  return {
    items: assets.map((asset) => ({
      ...asset,
      size_bytes: Number(asset.size_bytes),
      licenses: byAsset.get(asset.id) ?? [],
      signedUrl: signed.get(asset.storage_path) ?? null,
    })),
    nextCursor: page.nextCursor,
  };
}

export async function registerMedia(supabase: SupabaseClient, storagePath: string, originalName: string): Promise<string> {
  const { data, error } = await supabase.rpc("register_media_asset", { p_storage_path: storagePath, p_original_name: originalName });
  if (error) throw error;
  return data as string;
}

export async function recordLicense(supabase: SupabaseClient, organizationId: string, mediaId: string, input: LicenseInput) {
  const { error } = await supabase.from("media_licenses").insert({ organization_id: organizationId, media_asset_id: mediaId, ...input });
  if (error) throw error;
}

export async function revokeLicense(supabase: SupabaseClient, licenseId: string, reason: string) {
  const { error } = await supabase.rpc("revoke_media_license", { p_license_id: licenseId, p_reason: reason });
  if (error) throw error;
}

export async function archiveMedia(supabase: SupabaseClient, mediaId: string) {
  const { error } = await supabase.rpc("archive_media_asset", { p_media_id: mediaId });
  if (error) throw error;
}

/** Mídias do workspace, não arquivadas, entre os ids pedidos (ids de outro workspace ficam de fora). */
export async function findActiveMedia(
  supabase: SupabaseClient,
  organizationId: string,
  ids: readonly string[],
): Promise<Array<Pick<MediaRow, "id" | "storage_path" | "original_name">>> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from("media_assets")
    .select("id,storage_path,original_name")
    .eq("organization_id", organizationId)
    .is("archived_at", null)
    .in("id", [...ids]);
  if (error) throw error;
  return (data ?? []) as Array<Pick<MediaRow, "id" | "storage_path" | "original_name">>;
}

/** URLs assinadas (10 min) das mídias do workspace pedidas; ids desconhecidos não voltam. */
export async function signMediaUrls(supabase: SupabaseClient, organizationId: string, ids: readonly string[]): Promise<Record<string, string>> {
  const assets = await findActiveMedia(supabase, organizationId, ids);
  if (assets.length === 0) return {};
  const result = await supabase.storage.from(MEDIA_BUCKET).createSignedUrls(assets.map((asset) => asset.storage_path), 600);
  if (result.error) throw result.error;
  const byPath = new Map(assets.map((asset) => [asset.storage_path, asset.id]));
  const urls: Record<string, string> = {};
  for (const item of result.data ?? []) {
    const id = item.path ? byPath.get(item.path) : undefined;
    if (id && item.signedUrl) urls[id] = item.signedUrl;
  }
  return urls;
}
