/**
 * Mídia e licenças · service: regras de negócio e casos de uso (S4).
 * Combina schema (validação) e repository (dados). As Server Actions chamam o
 * service; cada uma mantém a sua mensagem de permissão.
 *
 * Regra permanente: sem licença válida o arquivo não pode ser publicado. Quem
 * decide isso é o banco (media_active_license / publication_checks); aqui só se
 * registra, revoga e arquiva.
 */
import type { Raw } from "@/lib/validation/fields";
import { recordLicense, type SupabaseClient } from "./repository";
import { parseLicenseInput } from "./schema";

/** Enviar mídia, registrar/revogar licenças e arquivar: owner ou admin (definição em tenancy). */
export { canEditContent as canManageMedia } from "@/lib/tenancy/service";

/** Valida a licença (data padrão = `today` no fuso do workspace) e a registra para o arquivo. */
export async function registerLicense(
  supabase: SupabaseClient,
  organizationId: string,
  mediaId: string,
  raw: Raw,
  today: string,
): Promise<void> {
  await recordLicense(supabase, organizationId, mediaId, parseLicenseInput(raw, today));
}
