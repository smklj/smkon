/**
 * Convites · schema: validação das entradas da API e do aceite (S4).
 * Funções puras sobre token.ts e src/lib/validation/fields.ts; imports
 * relativos com `.ts` para rodar em `node --test`.
 *
 * A API de convites responde com códigos próprios (`invalid_email`,
 * `invalid_role`), diferentes do `invalid_input` genérico de toErrorResponse.
 * InvitationInputError carrega esse código para a rota manter o contrato.
 */
import { ValidationError } from "../http/errors.ts";
import { isUuid } from "../validation/fields.ts";
import { isInvitableRole, isValidEmail, isWellFormedInviteToken, normalizeEmail, type InvitableRole } from "./token.ts";

export class InvitationInputError extends ValidationError {
  readonly code: "invalid_email" | "invalid_role";
  constructor(code: "invalid_email" | "invalid_role", message: string) {
    super(message);
    this.name = "InvitationInputError";
    this.code = code;
  }
}

export type InvitationInput = { email: string; role: InvitableRole };

/** Corpo do POST /api/invitations: e-mail normalizado primeiro, papel depois. */
export function parseInvitationRequest(body: unknown): InvitationInput {
  const raw = (body ?? {}) as { email?: unknown; role?: unknown };
  const email = normalizeEmail(raw.email);
  if (!isValidEmail(email)) throw new InvitationInputError("invalid_email", "E-mail inválido.");
  const role = raw.role;
  if (!isInvitableRole(role)) throw new InvitationInputError("invalid_role", "Papel inválido para convite.");
  return { email, role };
}

/** Id do convite a revogar (?id=), UUID estrito como nas demais rotas. */
export function parseInvitationId(value: unknown): string {
  if (!isUuid(value)) throw new ValidationError("Identificador inválido.");
  return value;
}

/** Token do link de aceite: formato conferido antes de qualquer consulta. */
export function parseAcceptToken(value: unknown): string {
  if (!isWellFormedInviteToken(value)) throw new ValidationError("Convite inválido, expirado ou já utilizado.");
  return value;
}
