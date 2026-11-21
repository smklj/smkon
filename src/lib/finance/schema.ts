/**
 * Financeiro · schema: validação de valores vindos do banco ou da interface (S4).
 * Funções puras sobre as primitivas de src/lib/validation/fields.ts; imports
 * relativos com `.ts` para rodar em `node --test`.
 */
import { isOneOf } from "../validation/fields.ts";
import { COMMISSION_STATUSES, type CommissionStatus } from "./commissions.ts";

/**
 * Estado de comissão conhecido. O banco já restringe from_status/to_status aos seis
 * estados (check constraint); a guarda protege a interface de um valor inesperado.
 */
export function isCommissionStatus(value: unknown): value is CommissionStatus {
  return isOneOf(value, COMMISSION_STATUSES);
}
