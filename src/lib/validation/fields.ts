/**
 * Validação de entrada centralizada (S4).
 *
 * Primitivas puras usadas pelos `schema.ts` de cada módulo. Todas lançam
 * ValidationError com mensagem segura para o usuário; nenhuma depende de
 * Next.js ou do Supabase, para serem testáveis com `node --test`.
 *
 * Regra do S4: as primitivas reproduzem exatamente o comportamento que cada
 * módulo já tinha. Onde módulos divergiam (ex.: aceitar número como texto,
 * UUID estrito x permissivo), existem variantes nomeadas em vez de unificar
 * em silêncio.
 */
import { ValidationError } from "../http/errors.ts";

/** Entrada bruta: corpo JSON já decodificado ou campos de um FormData. */
export type Raw = Record<string, unknown>;

/** Campo de texto: só strings, aparadas. Qualquer outro tipo vira "". */
export function readString(raw: Raw, key: string): string {
  const value = raw[key];
  return typeof value === "string" ? value.trim() : "";
}

/** Campo de texto que também aceita número (JSON da API), convertido com String(). */
export function readScalar(raw: Raw, key: string): string {
  const value = raw[key];
  return typeof value === "string" ? value.trim() : typeof value === "number" ? String(value) : "";
}

/** Checkbox de formulário ou booleano JSON: true, "on" ou "true". */
export function readFlag(raw: Raw, key: string): boolean {
  const value = raw[key];
  return value === true || value === "on" || value === "true";
}

/** Campos string de um FormData (arquivos são descartados). */
export function formDataToRaw(formData: FormData): Raw {
  return Object.fromEntries(Array.from(formData.entries()).filter(([, value]) => typeof value === "string"));
}

/** Corpo JSON que precisa ser um objeto (não array, não null). */
export function isPlainObject(value: unknown): value is Raw {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/**
 * Valor dentro de uma lista fechada. Com `fallback`, vazio vira o padrão;
 * qualquer outro valor fora da lista é recusado com `message`.
 */
export function oneOf<T extends string>(value: string, allowed: readonly T[], message: string, fallback: T | null = null): T {
  if (!value && fallback) return fallback;
  if ((allowed as readonly string[]).includes(value)) return value as T;
  throw new ValidationError(message);
}

/** Guarda de tipo para listas fechadas, sem lançar. */
export function isOneOf<T extends string>(value: unknown, allowed: readonly T[]): value is T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value);
}

/** UUID RFC 4122/9562 (versão 1–8, variante 10xx). Usado pelas rotas e Server Actions. */
const UUID_STRICT = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
/** UUID só pelo formato 8-4-4-4-12 (o que o Postgres aceita). Usado pelos parsers de formulário. */
const UUID_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_STRICT.test(value);
}

export function isUuidShape(value: unknown): value is string {
  return typeof value === "string" && UUID_SHAPE.test(value);
}

/** Identificador obrigatório (formato 8-4-4-4-12); lança com `message`. */
export function parseUuid(value: unknown, message = "Registro inválido."): string {
  if (!isUuidShape(value)) throw new ValidationError(message);
  return value;
}

/** Texto obrigatório com tamanho entre min e max (após trim). */
export function requireLength(value: string, min: number, max: number, message: string): string {
  if (value.length < min || value.length > max) throw new ValidationError(message);
  return value;
}

/** Texto opcional: vazio → null; preenchido precisa respeitar max. */
export function optionalText(value: string, max: number, message: string): string | null {
  if (!value) return null;
  if (value.length > max) throw new ValidationError(message);
  return value;
}

/** Converte "1.234,56", "1234.56" ou "197" em número. Vazio → null; inválido → NaN. */
export function parseDecimal(value: string): number | null {
  const clean = value.replace(/\s/g, "");
  if (!clean) return null;
  const normalized = clean.includes(",") ? clean.replace(/\./g, "").replace(",", ".") : clean;
  if (!/^-?\d+(\.\d+)?$/.test(normalized)) return Number.NaN;
  return Number(normalized);
}

/** Só https com host com ponto; sem credenciais embutidas, sem espaços, até 2048 caracteres. */
export function isHttpsUrl(value: string): boolean {
  if (!value || value.length > 2048 || /\s/.test(value)) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname.includes(".") && !url.username && !url.password;
  } catch {
    return false;
  }
}

/**
 * Variante permissiva do Studio (conteúdo): vazio é aceito e qualquer URL com
 * protocolo https: passa (sem exigir ponto no host nem recusar credenciais;
 * o tamanho é cortado em 2048 por quem chama). Mantida separada de isHttpsUrl
 * porque unificar recusaria links que o Studio hoje aceita.
 */
export function isOptionalHttpsUrl(value: string): boolean {
  if (!value) return true;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

/** Data de calendário AAAA-MM-DD (campo date). */
export const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** Fuso do workspace (Brasil, sem horário de verão desde 2019). */
export const WORKSPACE_OFFSET = "-03:00";

/** Data de hoje (AAAA-MM-DD) no fuso do workspace. */
export function workspaceDate(now: Date = new Date()): string {
  return new Date(now.getTime() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
}
