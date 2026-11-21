/**
 * Mídia e licenças · schema: tipos de entrada e validação (S4).
 * Funções puras que lançam ValidationError com mensagem segura para o usuário,
 * sobre as primitivas de src/lib/validation/fields.ts. Imports relativos com
 * `.ts` para rodar em `node --test`.
 */
import { ValidationError } from "../http/errors.ts";
import { DATE_ONLY, isHttpsUrl, isUuid, oneOf, readFlag, readString, type Raw } from "../validation/fields.ts";
import { LICENSE_TYPES, type LicenseType } from "./types.ts";

export type LicenseInput = {
  license_type: LicenseType;
  licensor: string;
  proof_url: string | null;
  allows_commercial_use: boolean;
  allows_modification: boolean;
  territory: string;
  valid_from: string;
  valid_until: string | null;
  notes: string | null;
};

/**
 * Licença de uso de um arquivo. Só texto é aceito (números do JSON viram vazio,
 * como antes: a mídia usa readString, não readScalar). Sem link de comprovação,
 * só "produção própria" é aceita. `today` é a data no fuso do workspace.
 */
export function parseLicenseInput(raw: Raw, today: string): LicenseInput {
  const license_type = oneOf(readString(raw, "license_type"), LICENSE_TYPES, "Tipo de licença inválido.");

  const licensor = readString(raw, "licensor");
  if (licensor.length < 2 || licensor.length > 200) throw new ValidationError("Informe quem concede a licença (2 a 200 caracteres).");

  const proof_url = readString(raw, "proof_url") || null;
  if (proof_url && !isHttpsUrl(proof_url)) throw new ValidationError("O link da comprovação deve começar com https://.");
  if (!proof_url && license_type !== "own_production") {
    throw new ValidationError("Anexe o link da comprovação (contrato, autorização ou página da licença).");
  }

  const valid_from = readString(raw, "valid_from") || today;
  const valid_until = readString(raw, "valid_until") || null;
  if (!DATE_ONLY.test(valid_from) || (valid_until && !DATE_ONLY.test(valid_until))) throw new ValidationError("Data inválida.");
  if (valid_until && valid_until < valid_from) throw new ValidationError("O fim da validade é anterior ao início.");

  const territory = readString(raw, "territory") || "Mundial";
  if (territory.length < 2 || territory.length > 100) throw new ValidationError("Território inválido.");

  const notes = readString(raw, "notes") || null;
  if (notes && notes.length > 1000) throw new ValidationError("Observações com até 1000 caracteres.");

  return {
    license_type,
    licensor,
    proof_url,
    allows_commercial_use: readFlag(raw, "allows_commercial_use"),
    allows_modification: readFlag(raw, "allows_modification"),
    territory,
    valid_from,
    valid_until,
    notes,
  };
}

/** Valor bruto de um campo de formulário como texto (null/ausente → ""). */
function fieldText(value: unknown): string {
  return String(value ?? "");
}

/** Identificador de arquivo de mídia vindo do formulário (UUID estrito, como as rotas). */
export function parseMediaId(value: unknown): string {
  const id = fieldText(value);
  if (!isUuid(id)) throw new ValidationError("Mídia inválida.");
  return id;
}

export type RevokeInput = { licenseId: string; reason: string };

/** Revogação de licença: identificador estrito e motivo com pelo menos 3 caracteres (aparado). */
export function parseRevokeInput(licenseIdValue: unknown, reasonValue: unknown): RevokeInput {
  const licenseId = fieldText(licenseIdValue);
  const reason = fieldText(reasonValue).trim();
  if (!isUuid(licenseId)) throw new ValidationError("Licença inválida.");
  if (reason.length < 3) throw new ValidationError("Informe o motivo da revogação.");
  return { licenseId, reason };
}
