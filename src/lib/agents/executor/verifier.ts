/**
 * Verifier determinístico (regra, não "outro LLM concordando").
 *
 * Regras (etapas 2 e 7 do S14):
 * 1. Pelo menos uma ferramenta executou com sucesso (resultado sem nenhuma observação não é verificável).
 * 2. Toda afirmação com productId cita ao menos uma evidência, e cada evidência citada foi OBSERVADA nesta
 *    execução pela ferramenta read_product_evidence, com review_status = "verified" e do mesmo produto.
 * 3. Afirmação que cita evidência precisa dizer de qual produto (productId); evidência solta não vale.
 * 4. Menção a produto sem afirmação ancorada: se o texto do resumo ou de uma afirmação menciona um produto
 *    observado nesta execução (id ou nome vindo de read_products / read_product_evidence), precisa existir
 *    uma afirmação com aquele productId e evidência verificada. Afirmação sem productId não pode falar de
 *    produto observado; afirmação com productId não pode falar de OUTRO produto observado.
 * 5. Rascunho (draft_content) que trata de produto observado só é executado se já houver evidência verificada
 *    desse produto observada na execução (checkDraftEvidence, chamado ANTES da ferramenta pelo loop).
 *
 * Falhar fechado: na dúvida (nome mencionado sem âncora), reprova com evidence_missing.
 *
 * Contratos de saída usados (fixados na etapa 3):
 *   read_product_evidence → { items: [{ id, product_id, review_status, ... }] }
 *   read_products         → { items: [{ id, name, ... }] }
 */
import type { JsonObject, Observation, RunContext, Summary, VerifyResult } from "./types.ts";

type EvidenceRow = { id: string; productId: string | null };

/** Nomes curtos demais geram falso positivo em texto livre; abaixo disso só o id conta como menção. */
export const MIN_PRODUCT_NAME_CHARS = 4;

function okItems(observations: readonly Observation[], tool: string): Record<string, unknown>[] {
  const rows: Record<string, unknown>[] = [];
  for (const observation of observations) {
    if (observation.tool !== tool || observation.status !== "ok") continue;
    const items = observation.output.items;
    if (!Array.isArray(items)) continue;
    for (const item of items) if (item && typeof item === "object" && !Array.isArray(item)) rows.push(item as Record<string, unknown>);
  }
  return rows;
}

function verifiedEvidence(observations: readonly Observation[]): Map<string, EvidenceRow> {
  const found = new Map<string, EvidenceRow>();
  for (const row of okItems(observations, "read_product_evidence")) {
    if (row.review_status !== "verified" || typeof row.id !== "string") continue;
    found.set(row.id.toLowerCase(), {
      id: row.id.toLowerCase(),
      productId: typeof row.product_id === "string" ? row.product_id.toLowerCase() : null,
    });
  }
  return found;
}

/** Produtos com ao menos uma evidência verificada observada nesta execução. */
function productsWithVerifiedEvidence(observations: readonly Observation[]): Set<string> {
  const products = new Set<string>();
  for (const row of verifiedEvidence(observations).values()) if (row.productId) products.add(row.productId);
  return products;
}

/** Normaliza para comparação: minúsculas, sem acento, espaços colapsados. */
export function normalizeText(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

interface ObservedProduct {
  id: string;
  names: string[];
}

/** Produtos que a execução observou (ids de read_products e de read_product_evidence; nomes de read_products). */
export function observedProducts(observations: readonly Observation[]): ObservedProduct[] {
  const byId = new Map<string, Set<string>>();
  const touch = (id: unknown): Set<string> | null => {
    if (typeof id !== "string" || id.length === 0) return null;
    const key = id.toLowerCase();
    if (!byId.has(key)) byId.set(key, new Set());
    return byId.get(key)!;
  };
  for (const row of okItems(observations, "read_products")) {
    const names = touch(row.id);
    if (names && typeof row.name === "string") {
      const name = normalizeText(row.name);
      if (name.length >= MIN_PRODUCT_NAME_CHARS) names.add(name);
    }
  }
  for (const row of okItems(observations, "read_product_evidence")) touch(row.product_id);
  return [...byId.entries()].map(([id, names]) => ({ id, names: [...names] }));
}

/** Ids dos produtos observados mencionados no texto (por id ou por nome inteiro, sem acento e sem caixa). */
export function mentionedProducts(text: string, products: readonly ObservedProduct[]): string[] {
  const haystack = normalizeText(text);
  const found: string[] = [];
  for (const product of products) {
    const byId = haystack.includes(product.id);
    const byName = product.names.some((name) => new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRegExp(name)}($|[^\\p{L}\\p{N}])`, "u").test(haystack));
    if (byId || byName) found.push(product.id);
  }
  return found;
}

export function verifyRun(_ctx: RunContext, observations: readonly Observation[], summary: Summary): VerifyResult {
  const reasons: string[] = [];
  if (!observations.some((observation) => observation.status === "ok")) {
    return { ok: false, code: "verify_failed", reasons: ["nenhuma ferramenta executou com sucesso"] };
  }

  const evidence = verifiedEvidence(observations);
  const anchored = new Set<string>(); // produtos com ao menos uma afirmação válida
  summary.claims.forEach((claim, index) => {
    const label = `afirmação ${index + 1}`;
    if (!claim.productId) {
      if (claim.evidenceIds.length > 0) reasons.push(`${label}: cita evidência sem dizer o produto`);
      return;
    }
    if (claim.evidenceIds.length === 0) {
      reasons.push(`${label}: produto sem evidência citada`);
      return;
    }
    let valid = true;
    for (const id of claim.evidenceIds) {
      const row = evidence.get(id);
      if (!row) {
        reasons.push(`${label}: evidência ${id} não verificada nesta execução`);
        valid = false;
      } else if (row.productId !== claim.productId) {
        reasons.push(`${label}: evidência ${id} é de outro produto`);
        valid = false;
      }
    }
    if (valid) anchored.add(claim.productId);
  });

  const products = observedProducts(observations);
  if (products.length > 0) {
    for (const productId of mentionedProducts(summary.text, products)) {
      if (!anchored.has(productId)) reasons.push(`resumo menciona o produto ${productId} sem afirmação com evidência verificada`);
    }
    summary.claims.forEach((claim, index) => {
      for (const productId of mentionedProducts(claim.text, products)) {
        if (productId !== claim.productId) reasons.push(`afirmação ${index + 1}: menciona o produto ${productId} sem citá-lo como productId`);
      }
    });
  }

  return reasons.length > 0 ? { ok: false, code: "evidence_missing", reasons: [...new Set(reasons)] } : { ok: true, reasons: [] };
}

/**
 * Regra 5 — chamada pelo loop ANTES de executar draft_content. Se o rascunho trata de um produto observado
 * (campo `product` ou texto que menciona id/nome), esse produto precisa ter evidência verificada já observada.
 * Campo `product` preenchido com algo que não corresponde a nenhum produto observado também reprova:
 * sem leitura do produto não há como conferir a evidência.
 */
export function checkDraftEvidence(observations: readonly Observation[], input: JsonObject): VerifyResult {
  const products = observedProducts(observations);
  const verified = productsWithVerifiedEvidence(observations);
  const reasons: string[] = [];

  const texts = ["title", "product", "script", "caption", "cta", "hashtags"]
    .map((key) => input[key])
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0);
  const mentioned = new Set(texts.flatMap((text) => mentionedProducts(text, products)));

  const productField = typeof input.product === "string" ? input.product.trim() : "";
  if (productField.length > 0 && mentionedProducts(productField, products).length === 0) {
    reasons.push("rascunho cita produto que não foi lido nesta execução");
  }
  for (const productId of mentioned) {
    if (!verified.has(productId)) reasons.push(`rascunho trata do produto ${productId} sem evidência verificada`);
  }
  return reasons.length > 0 ? { ok: false, code: "evidence_missing", reasons } : { ok: true, reasons: [] };
}
