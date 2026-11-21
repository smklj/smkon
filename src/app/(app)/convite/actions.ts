"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { businessErrorMessage } from "@/lib/http/errors";
import { isWellFormedInviteToken } from "@/lib/invitations/token";
import { acceptInvitation as acceptInvitationToken } from "@/lib/invitations/service";
import { consumeRateLimit } from "@/lib/http/rate-limit";
import { errorFields, log } from "@/lib/observability/log";
import { isMissingSchemaObject } from "@/lib/tenancy/members";
import { setActiveWorkspace } from "@/lib/tenancy/service";

export type AcceptState = { error: string } | null;

export async function acceptInvitation(_prev: AcceptState, formData: FormData): Promise<AcceptState> {
  const token = formData.get("token");
  if (!isWellFormedInviteToken(token)) return { error: "Convite inválido, expirado ou já utilizado." };

  const supabase = await createClient();
  const limit = await consumeRateLimit(supabase, "invite_accept");
  if (!limit.allowed) return { error: "Muitas tentativas. Aguarde alguns minutos e tente novamente." };

  const { workspaceId, error } = await acceptInvitationToken(supabase, token);
  if (error) {
    const message = businessErrorMessage(error, "Não foi possível aceitar o convite.");
    if (message === "Não foi possível aceitar o convite.") {
      log("error", "invite.accept", { code: error.code ?? "unknown" });
    }
    return { error: message };
  }
  // Abre o workspace do convite. Falha aqui não desfaz o aceite: o seletor continua disponível.
  if (workspaceId) {
    try {
      await setActiveWorkspace(supabase, workspaceId);
    } catch (switchError) {
      if (!isMissingSchemaObject(switchError as { code?: string })) log("warn", "invite.accept.switch", errorFields(switchError));
    }
  }
  redirect("/?convite=aceito");
}
