import type { createClient } from "@/lib/supabase/server";
import { MEDIA_BUCKET, type LicenseRow, type MediaRow } from "./types";
import type { LicenseInput } from "./validation";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

const MEDIA_COLUMNS = "id,storage_path,kind,mime_type,size_bytes,original_name,created_at,archived_at";
const LICENSE_COLUMNS =
  "id,media_asset_id,license_type,licensor,proof_url,allows_commercial_use,allows_modification,territory,valid_from,valid_until,notes,created_at,revoked_at,revoke_reason";

export type MediaWithLicenses = MediaRow & { licenses: LicenseRow[]; signedUrl: string | null };

export async function listMedia(
  supabase: SupabaseClient,
  organizationId: string,
  { includeArchived = false, signUrls = false } = {},
): Promise<MediaWithLicenses[]> {
  let query = supabase
    .from("media_assets")
    .select(MEDIA_COLUMNS)
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (!includeArchived) query = query.is("archived_at", null);
  const { data, error } = await query;
  if (error) throw error;
  const assets = (data ?? []) as MediaRow[];
  if (assets.length === 0) return [];

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

  return assets.map((asset) => ({
    ...asset,
    size_bytes: Number(asset.size_bytes),
    licenses: byAsset.get(asset.id) ?? [],
    signedUrl: signed.get(asset.storage_path) ?? null,
  }));
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
