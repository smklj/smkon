import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/content/server";
import { jsonError, toErrorResponse } from "@/lib/http/errors";
import { siteUrl } from "@/lib/http/site-url";
import { consumeRateLimit } from "@/lib/http/rate-limit";
import { generateInviteToken, isInvitableRole, isValidEmail, normalizeEmail } from "@/lib/invitations/token";
import { findWorkspace } from "@/lib/tenancy/workspace";

// Sem token_hash: a coluna nem é legível pela API.
const INVITATION_COLUMNS = "id,email,role,created_at,expires_at,accepted_at,revoked_at";

async function requireManager() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { response: jsonError(401, "not_authenticated", "Não autenticado.") } as const;
  const workspace = await findWorkspace(supabase, user.id);
  if (!workspace || (workspace.role !== "owner" && workspace.role !== "admin")) {
    return { response: jsonError(403, "forbidden", "Apenas owner ou admin gerenciam convites.") } as const;
  }
  return { supabase, workspace } as const;
}

export async function GET() {
  try {
    const ctx = await requireManager();
    if ("response" in ctx) return ctx.response;
    const { data, error } = await ctx.supabase
      .from("organization_invitations")
      .select(INVITATION_COLUMNS)
      .eq("organization_id", ctx.workspace.organizationId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw error;
    return NextResponse.json({ items: data ?? [] });
  } catch (error) {
    return toErrorResponse("api.invitations.get", error, "Não foi possível carregar os convites.");
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await requireManager();
    if ("response" in ctx) return ctx.response;

    let body: { email?: unknown; role?: unknown };
    try {
      body = await request.json();
    } catch {
      return jsonError(400, "invalid_input", "Corpo da requisição inválido.");
    }
    const email = normalizeEmail(body?.email);
    if (!isValidEmail(email)) return jsonError(400, "invalid_email", "E-mail inválido.");
    const role = body?.role;
    if (!isInvitableRole(role)) return jsonError(400, "invalid_role", "Papel inválido para convite.");

    const limit = await consumeRateLimit(ctx.supabase, "invite_create");
    if (!limit.allowed) {
      return NextResponse.json(
        { error: "Muitos convites em pouco tempo. Tente novamente mais tarde.", code: "rate_limited" },
        { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
      );
    }

    // O workspace vem da sessão, nunca do corpo da requisição.
    const { token, tokenHash } = generateInviteToken();
    const { data, error } = await ctx.supabase.rpc("create_invitation", {
      p_organization_id: ctx.workspace.organizationId,
      p_email: email,
      p_role: role,
      p_token_hash: tokenHash,
    });
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    if (!row?.invitation_id) throw new Error("create_invitation returned no row");

    if (!row.created) {
      // Idempotente: convite pendente já existe; nenhum token novo é emitido.
      return NextResponse.json(
        { id: row.invitation_id, created: false, expiresAt: row.invitation_expires_at },
        { status: 200 },
      );
    }

    // O link com o token é devolvido uma única vez, ao criador. Nunca é registrado em log.
    const acceptUrl = `${await siteUrl()}/convite?token=${encodeURIComponent(token)}`;
    return NextResponse.json(
      { id: row.invitation_id, created: true, expiresAt: row.invitation_expires_at, acceptUrl },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return toErrorResponse("api.invitations.post", error, "Não foi possível criar o convite.");
  }
}

export async function DELETE(request: Request) {
  try {
    const ctx = await requireManager();
    if ("response" in ctx) return ctx.response;
    const id = new URL(request.url).searchParams.get("id");
    if (!isUuid(id)) return jsonError(400, "invalid_input", "Identificador inválido.");
    const { error } = await ctx.supabase.rpc("revoke_invitation", { p_invitation_id: id });
    if (error) throw error;
    return NextResponse.json({ ok: true, id });
  } catch (error) {
    return toErrorResponse("api.invitations.delete", error, "Não foi possível revogar o convite.");
  }
}
