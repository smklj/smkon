import { ValidationError } from "../http/errors.ts";
import { isHttpsUrl } from "../products/validation.ts";
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

const DATE = /^\d{4}-\d{2}-\d{2}$/;

function text(raw: Record<string, unknown>, key: string): string {
  const value = raw[key];
  return typeof value === "string" ? value.trim() : "";
}

function flag(raw: Record<string, unknown>, key: string): boolean {
  const value = raw[key];
  return value === true || value === "on" || value === "true";
}

export function parseLicenseInput(raw: Record<string, unknown>, today: string): LicenseInput {
  const type = text(raw, "license_type");
  if (!(LICENSE_TYPES as readonly string[]).includes(type)) throw new ValidationError("Tipo de licença inválido.");
  const license_type = type as LicenseType;

  const licensor = text(raw, "licensor");
  if (licensor.length < 2 || licensor.length > 200) throw new ValidationError("Informe quem concede a licença (2 a 200 caracteres).");

  const proof_url = text(raw, "proof_url") || null;
  if (proof_url && !isHttpsUrl(proof_url)) throw new ValidationError("O link da comprovação deve começar com https://.");
  if (!proof_url && license_type !== "own_production") {
    throw new ValidationError("Anexe o link da comprovação (contrato, autorização ou página da licença).");
  }

  const valid_from = text(raw, "valid_from") || today;
  const valid_until = text(raw, "valid_until") || null;
  if (!DATE.test(valid_from) || (valid_until && !DATE.test(valid_until))) throw new ValidationError("Data inválida.");
  if (valid_until && valid_until < valid_from) throw new ValidationError("O fim da validade é anterior ao início.");

  const territory = text(raw, "territory") || "Mundial";
  if (territory.length < 2 || territory.length > 100) throw new ValidationError("Território inválido.");

  const notes = text(raw, "notes") || null;
  if (notes && notes.length > 1000) throw new ValidationError("Observações com até 1000 caracteres.");

  return {
    license_type,
    licensor,
    proof_url,
    allows_commercial_use: flag(raw, "allows_commercial_use"),
    allows_modification: flag(raw, "allows_modification"),
    territory,
    valid_from,
    valid_until,
    notes,
  };
}
