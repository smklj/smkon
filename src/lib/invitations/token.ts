import { createHash, randomBytes } from "node:crypto";

/** Papéis que podem ser convidados. "owner" nunca é convidável (transferência é outro fluxo). */
export const INVITABLE_ROLES = ["admin", "analyst", "viewer"] as const;
export type InvitableRole = (typeof INVITABLE_ROLES)[number];

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export function isValidEmail(email: string): boolean {
  return email.length > 0 && email.length <= 254 && EMAIL_PATTERN.test(email);
}

export function isInvitableRole(value: unknown): value is InvitableRole {
  return typeof value === "string" && (INVITABLE_ROLES as readonly string[]).includes(value);
}

/** SHA-256 hexadecimal do token. Só o hash vai para o banco. */
export function hashInviteToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/** Token aleatório (256 bits, base64url) e seu hash. O token só aparece no link entregue ao convidado. */
export function generateInviteToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: hashInviteToken(token) };
}

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function isWellFormedInviteToken(value: unknown): value is string {
  return typeof value === "string" && TOKEN_PATTERN.test(value);
}
