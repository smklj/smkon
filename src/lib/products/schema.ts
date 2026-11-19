/**
 * Produtos · schema: tipos de entrada e validação (S4).
 * Usa as primitivas centralizadas de src/lib/validation/fields.ts.
 */
import { ValidationError } from "../http/errors.ts";
import {
  DATE_ONLY,
  isHttpsUrl,
  isOneOf,
  isUuidShape,
  oneOf,
  parseDecimal,
  readScalar as text,
  workspaceDate,
  WORKSPACE_OFFSET,
  type Raw,
} from "../validation/fields.ts";
import {
  EVIDENCE_KIND_META,
  EVIDENCE_KINDS,
  PRODUCT_SOURCES,
  PRODUCT_STATUSES,
  PRODUCT_TYPES,
  REVENUE_DOMAINS,
  type EvidenceKind,
  type ProductSource,
  type ProductStatus,
  type ProductType,
  type RevenueDomain,
} from "./types.ts";

export { isHttpsUrl, parseDecimal, workspaceDate };

export type ProductInput = {
  name: string;
  source: ProductSource;
  type: ProductType;
  status: ProductStatus;
  revenue_domain: RevenueDomain;
  currency: string;
  price_cents: number | null;
  commission_percent: number | null;
  affiliate_url: string | null;
  external_id: string | null;
};

export type EvidenceInput = {
  kind: EvidenceKind;
  claim: string;
  source_url: string;
  value: number | null;
  observed_at: string;
};

export function parseProductInput(raw: Raw): ProductInput {
  const name = text(raw, "name");
  if (name.length < 1 || name.length > 200) throw new ValidationError("O nome deve ter entre 1 e 200 caracteres.");

  const source = oneOf(text(raw, "source"), PRODUCT_SOURCES, "Fonte inválida.", null);
  const type = oneOf(text(raw, "type"), PRODUCT_TYPES, "Tipo inválido.", "unknown");
  const status = oneOf(text(raw, "status"), PRODUCT_STATUSES, "Status inválido.", "discovered");
  const revenue_domain = oneOf(text(raw, "revenue_domain") || text(raw, "revenueDomain"), REVENUE_DOMAINS, "Domínio de receita inválido.", "affiliate");

  const currency = (text(raw, "currency") || "BRL").toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) throw new ValidationError("Moeda deve ter 3 letras (ex.: BRL).");

  const price = parseDecimal(text(raw, "price"));
  if (price !== null && (!Number.isFinite(price) || price < 0 || price > 10_000_000)) throw new ValidationError("Preço inválido.");

  const commission = parseDecimal(text(raw, "commission_percent") || text(raw, "commissionPercent"));
  if (commission !== null && (!Number.isFinite(commission) || commission < 0 || commission > 100)) {
    throw new ValidationError("Comissão deve estar entre 0 e 100%.");
  }

  const affiliate_url = text(raw, "affiliate_url") || null;
  if (affiliate_url && !isHttpsUrl(affiliate_url)) throw new ValidationError("O link de afiliado deve começar com https://.");

  const external_id = text(raw, "external_id") || null;
  if (external_id && external_id.length > 200) throw new ValidationError("ID externo muito longo.");

  return {
    name,
    source,
    type,
    status,
    revenue_domain,
    currency,
    price_cents: price === null ? null : Math.round(price * 100),
    commission_percent: commission === null ? null : Math.round(commission * 100) / 100,
    affiliate_url,
    external_id,
  };
}

export function parseEvidenceInput(raw: Raw, now: Date = new Date()): EvidenceInput {
  const kind = oneOf(text(raw, "kind"), EVIDENCE_KINDS, "Tipo de evidência inválido.", null);
  const meta = EVIDENCE_KIND_META[kind];

  const claim = text(raw, "claim");
  if (claim.length < 3 || claim.length > 500) throw new ValidationError("Descreva a evidência em 3 a 500 caracteres.");

  const source_url = text(raw, "source_url");
  if (!isHttpsUrl(source_url)) throw new ValidationError("Informe o link https da fonte.");

  const parsed = parseDecimal(text(raw, "value"));
  let value: number | null = null;
  if (meta.value === "none") {
    if (parsed !== null) throw new ValidationError(`${meta.label} não leva valor numérico.`);
  } else {
    if (parsed === null && meta.value === "required") throw new ValidationError(`${meta.label} exige um valor.`);
    if (parsed !== null) {
      if (!Number.isFinite(parsed) || parsed < (meta.min ?? 0) || parsed > (meta.max ?? Number.MAX_SAFE_INTEGER)) {
        throw new ValidationError(`Valor de ${meta.label.toLowerCase()} fora do intervalo ${meta.min}–${meta.max}.`);
      }
      value = Math.round(parsed * 100) / 100;
    }
  }

  const observedRaw = text(raw, "observed_at");
  let observed = now;
  if (observedRaw && DATE_ONLY.test(observedRaw)) {
    // Data sem hora (campo date) é um dia no fuso do workspace: hoje = agora; dia passado = meio-dia de Brasília.
    const today = workspaceDate(now);
    if (observedRaw > today) throw new ValidationError("A data de observação não pode estar no futuro.");
    observed = observedRaw === today ? now : new Date(`${observedRaw}T12:00:00${WORKSPACE_OFFSET}`);
    if (Number.isNaN(observed.getTime())) throw new ValidationError("Data de observação inválida.");
  } else if (observedRaw) {
    observed = new Date(observedRaw);
    if (Number.isNaN(observed.getTime())) throw new ValidationError("Data de observação inválida.");
  }
  if (observed.getTime() > now.getTime() + 5 * 60 * 1000) throw new ValidationError("A data de observação não pode estar no futuro.");

  return { kind, claim, source_url, value, observed_at: observed.toISOString() };
}

export function parseReviewInput(raw: Raw): { evidenceId: string; decision: "verified" | "rejected"; note: string | null } {
  const evidenceId = text(raw, "evidence_id") || text(raw, "evidenceId");
  if (!isUuidShape(evidenceId)) throw new ValidationError("Evidência inválida.");
  const decision = text(raw, "decision");
  if (decision !== "verified" && decision !== "rejected") throw new ValidationError("Decisão inválida.");
  const note = text(raw, "note") || null;
  if (note && note.length > 500) throw new ValidationError("O motivo deve ter até 500 caracteres.");
  if (decision === "rejected" && !note) throw new ValidationError("Informe o motivo da rejeição.");
  return { evidenceId, decision, note };
}

/** Status de produto vindo de formulário (sem lançar). */
export function isProductStatus(value: unknown): value is ProductStatus {
  return isOneOf(value, PRODUCT_STATUSES);
}
