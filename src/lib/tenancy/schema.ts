/**
 * Tenancy · schema: validação das entradas de workspace e membros (S4).
 * Funções puras sobre as primitivas de src/lib/validation/fields.ts; lançam
 * ValidationError com as mesmas mensagens que as Server Actions já mostravam.
 * Imports relativos com `.ts` para rodar em `node --test`.
 *
 * Os ids chegam de formulários; o banco ainda confere membership e papel
 * (set_active_workspace, change_member_role, remove_member). Aqui só se recusa
 * o que nem chega a ser um UUID, antes de autenticar ou consultar.
 */
import { ValidationError } from "../http/errors.ts";
import { isUuid, type Raw } from "../validation/fields.ts";
import { isMemberRole, type MemberRole } from "./members.ts";

/** Campo de formulário como texto: ausente vira "" (mesmo efeito de String(formData.get(k) ?? "")). */
function field(raw: Raw, key: string): string {
  const value = raw[key];
  return value === undefined || value === null ? "" : String(value);
}

/** Workspace escolhido no seletor (campo organization_id). */
export function parseWorkspaceId(raw: Raw): string {
  const organizationId = field(raw, "organization_id");
  if (!isUuid(organizationId)) throw new ValidationError("Workspace inválido.");
  return organizationId;
}

/** Membro alvo de uma ação (campo user_id). */
export function parseMemberId(raw: Raw): string {
  const userId = field(raw, "user_id");
  if (!isUuid(userId)) throw new ValidationError("Membro inválido.");
  return userId;
}

export type MemberRoleChangeInput = { userId: string; role: MemberRole };

/** Troca de papel: membro primeiro, papel depois (mesma ordem de mensagens de antes). */
export function parseMemberRoleChange(raw: Raw): MemberRoleChangeInput {
  const userId = parseMemberId(raw);
  const role = field(raw, "role");
  if (!isMemberRole(role)) throw new ValidationError("Papel inválido.");
  return { userId, role };
}
