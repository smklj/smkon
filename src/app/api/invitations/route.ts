import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { jsonError, toErrorResponse } from "@/lib/http/errors";
import { siteUrl } from "@/lib/http/site-url";
import { consumeRateLimit } from "@/lib/http/rate-limit";
import { InvitationInputError, parseInvitationId, parseInvitationRequest } from "@/lib/invitations/schema";
import { createInvitation, listInvitations, revokeInvitation } from "@/lib/invitations/service";
import { canManageInvitations, findWorkspace } from "@/lib/tenancy/service";

async function requireManager() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { response: jsonError(401, "not_authenticated", "Não autenticado.") } as const;
  const workspace = await findWorkspace(supabase, user.id);
  if (!workspace || !canManageInvitations(workspace.role)) {
    return { response: jsonError(403, "forbidden", "Apenas owner ou admin gerenciam convites.") } as const;
  }
  return { supabase, workspace } as const;
}

export async function GET() {
  try {
    const ctx = await requireManager();
    if ("response" in ctx) return ctx.response;
    const items = await listInvitations(ctx.supabase, ctx.workspace.organizationId);
    return NextResponse.json({ items });
  } catch (error) {
    return toErrorResponse("api.invitations.get", error, "Não foi possível carregar os convites.");
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await requireManager();
    if ("response" in ctx) return ctx.response;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonError(400, "invalid_input", "Corpo da requisição inválido.");
    }
    let input;
    try {
      input = parseInvitationRequest(body);
    } catch (error) {
      if (error instanceof InvitationInputError) return jsonError(400, error.code, error.message);
      throw error;
    }

    const limit = await consumeRateLimit(ctx.supabase, "invite_create");
    if (!limit.allowed) {
      return NextResponse.json(
        { error: "Muitos convites em pouco tempo. Tente novamente mais tarde.", code: "rate_limited" },
        { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
      );
    }

    // O workspace vem da sessão, nunca do corpo da requisição.
    const invitation = await createInvitation(ctx.supabase, ctx.workspace.organizationId, input);

    if (!invitation.created) {
      // Idempotente: convite pendente já existe; nenhum token novo é emitido.
      return NextResponse.json(
        { id: invitation.id, created: false, expiresAt: invitation.expiresAt },
        { status: 200 },
      );
    }

    // O link com o token é devolvido uma única vez, ao criador. Nunca é registrado em log.
    const acceptUrl = `${await siteUrl()}/convite?token=${encodeURIComponent(invitation.token)}`;
    return NextResponse.json(
      { id: invitation.id, created: true, expiresAt: invitation.expiresAt, acceptUrl },
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
    // ValidationError → 400 invalid_input "Identificador inválido." (toErrorResponse, sem log).
    const id = parseInvitationId(new URL(request.url).searchParams.get("id"));
    await revokeInvitation(ctx.supabase, id);
    return NextResponse.json({ ok: true, id });
  } catch (error) {
    return toErrorResponse("api.invitations.delete", error, "Não foi possível revogar o convite.");
  }
}
