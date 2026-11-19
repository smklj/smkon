/**
 * Produtos · service: regras de negócio e casos de uso (S4).
 * Combina schema (validação) e repository (dados). As Server Actions e as rotas
 * de API chamam o service; cada uma mantém a sua mensagem de permissão.
 */
import type { Raw } from "@/lib/validation/fields";
import { addEvidence, createProduct, reviewEvidence, type SupabaseClient } from "./repository";
import { parseEvidenceInput, parseProductInput, parseReviewInput } from "./schema";

/** Cadastrar produto, alterar status e revisar evidências: owner ou admin. */
export function canEditProducts(role: string): boolean {
  return role === "owner" || role === "admin";
}

/** Registrar evidência (fica pendente até a revisão): owner, admin ou analyst. */
export function canAddEvidence(role: string): boolean {
  return role === "owner" || role === "admin" || role === "analyst";
}

/** Valida a entrada e cadastra o produto (sem score: o score só vem de evidência verificada). */
export async function registerProduct(supabase: SupabaseClient, organizationId: string, raw: Raw): Promise<string> {
  return createProduct(supabase, organizationId, parseProductInput(raw));
}

/** Valida e registra uma evidência pendente para o produto. */
export async function submitEvidence(supabase: SupabaseClient, organizationId: string, productId: string, raw: Raw): Promise<void> {
  await addEvidence(supabase, organizationId, productId, parseEvidenceInput(raw));
}

/** Valida a decisão e revisa a evidência; o banco recalcula o score (review_product_evidence). */
export async function decideEvidence(supabase: SupabaseClient, raw: Raw): Promise<number | null> {
  const { evidenceId, decision, note } = parseReviewInput(raw);
  return reviewEvidence(supabase, evidenceId, decision, note);
}
