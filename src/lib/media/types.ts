/** S10b — mídia e licenças. Espelha as constraints do banco e do bucket `content-media`. */

export const MEDIA_BUCKET = "content-media";
export const MEDIA_MAX_BYTES = 52_428_800; // 50 MB (limite do bucket e do plano)

export const MEDIA_TYPES: Record<string, { ext: string; kind: "video" | "image" }> = {
  "video/mp4": { ext: "mp4", kind: "video" },
  "video/quicktime": { ext: "mov", kind: "video" },
  "image/jpeg": { ext: "jpg", kind: "image" },
  "image/png": { ext: "png", kind: "image" },
  "image/webp": { ext: "webp", kind: "image" },
};

export const MEDIA_ACCEPT = Object.keys(MEDIA_TYPES).join(",");

export const LICENSE_TYPES = ["own_production", "creator_authorization", "licensed", "stock", "public_domain"] as const;
export type LicenseType = (typeof LICENSE_TYPES)[number];

export const LICENSE_TYPE_LABEL: Record<LicenseType, string> = {
  own_production: "Produção própria",
  creator_authorization: "Autorização do criador",
  licensed: "Licenciada (contrato)",
  stock: "Banco de imagens/vídeos",
  public_domain: "Domínio público",
};

export type LicenseRow = {
  id: string;
  media_asset_id: string;
  license_type: LicenseType;
  licensor: string;
  proof_url: string | null;
  allows_commercial_use: boolean;
  allows_modification: boolean;
  territory: string;
  valid_from: string;
  valid_until: string | null;
  notes: string | null;
  created_at: string;
  revoked_at: string | null;
  revoke_reason: string | null;
};

export type MediaRow = {
  id: string;
  storage_path: string;
  kind: "video" | "image";
  mime_type: string;
  size_bytes: number;
  original_name: string;
  created_at: string;
  archived_at: string | null;
};

export type LicenseStatus = "valid" | "expired" | "revoked" | "not_commercial" | "none";

export const LICENSE_STATUS_LABEL: Record<LicenseStatus, string> = {
  valid: "Licenciada",
  expired: "Licença vencida",
  revoked: "Licença revogada",
  not_commercial: "Sem uso comercial",
  none: "Sem licença",
};

export const LICENSE_STATUS_TONE: Record<LicenseStatus, "ok" | "warn" | "danger" | "neutral"> = {
  valid: "ok",
  expired: "warn",
  revoked: "danger",
  not_commercial: "warn",
  none: "danger",
};

/** Mesma regra de public.media_active_license: não revogada, uso comercial e vigente na data. */
export function licenseStatus(licenses: LicenseRow[], today: string): LicenseStatus {
  if (licenses.length === 0) return "none";
  const active = licenses.filter((license) => !license.revoked_at);
  if (active.length === 0) return "revoked";
  const commercial = active.filter((license) => license.allows_commercial_use);
  if (commercial.length === 0) return "not_commercial";
  const current = commercial.some(
    (license) => license.valid_from <= today && (!license.valid_until || license.valid_until >= today),
  );
  return current ? "valid" : "expired";
}

/** Data de hoje no fuso de Brasília (YYYY-MM-DD). */
export function todayInBrazil(now: Date = new Date()): string {
  return new Date(now.getTime() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/** Valida o arquivo antes do upload. Retorna a extensão a usar no caminho. */
export function validateMediaFile(file: { type: string; size: number; name: string }): { ext: string; kind: "video" | "image" } {
  const type = MEDIA_TYPES[file.type];
  if (!type) throw new Error("Formato não aceito. Use MP4, MOV, JPG, PNG ou WebP.");
  if (file.size <= 0) throw new Error("Arquivo vazio.");
  if (file.size > MEDIA_MAX_BYTES) throw new Error("Arquivo maior que 50 MB.");
  if (!file.name.trim() || file.name.length > 255) throw new Error("Nome de arquivo inválido.");
  return type;
}

export function mediaStoragePath(organizationId: string, fileId: string, ext: string): string {
  return `${organizationId}/${fileId}.${ext}`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}
