/**
 * Compatibilidade (S4): o conteúdo foi dividido em schema.ts (validação),
 * repository.ts (dados) e service.ts (regras). Este arquivo só reexporta o que
 * os testes existentes importam; o código da aplicação importa dos arquivos novos.
 */
export { CONTENT_KEYSET, CONTENT_SELECT_COLUMNS } from "./repository.ts";
export { CONTENT_HASH_PATTERN, CONTENT_STATUSES, parseContentStatusFilter } from "./schema.ts";
/** A definição única de UUID estrito está em src/lib/validation/fields.ts. */
export { isUuid } from "../validation/fields.ts";
