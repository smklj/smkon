"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { businessErrorMessage } from "@/lib/http/errors";
import { hashInviteToken, isWellFormedInviteToken } from "@/lib/invitations/token";
import { consumeRateLimit } from "@/lib/http/rate-limit";
import { errorFields, log } from "@/lib/observability/log";
import { setActiveWorkspace } from "@/lib/tenancy/admin";
import { isMissingSchemaObject } from "@/lib/tenancy/members";

export type AcceptState = { error: string } | null;

export async function acceptInvitation(_prev: AcceptState, formData: FormData): Promise<AcceptState> {
  const token = formData.get("token");
  if (!isWellFormedInviteToken(token)) return { error: "Convite inválido, expirado ou já utilizado." };

  const supabase = await createClient();
  const limit = await consumeRateLimit(supabase, "invite_accept");
  if (!limit.allowed) return { error: "Muitas tentativas. Aguarde alguns minutos e tente novamente." };

  const { data, error } = await supabase.rpc("accept_invitation", { p_token_hash: hashInviteToken(token) });
  if (error) {
    const message = businessErrorMessage(error, "Não foi possível aceitar o convite.");
    if (message === "Não foi possível aceitar o convite.") {
      log("error", "invite.accept", { code: error.code ?? "unknown" });
    }
    return { error: message };
  }
  // Abre o workspace do convite. Falha aqui não desfaz o aceite: o seletor continua disponível.
  const row = Array.isArray(data) ? data[0] : data;
  if (row?.workspace_id) {
    try {
      await setActiveWorkspace(supabase, row.workspace_id);
    } catch (switchError) {
      if (!isMissingSchemaObject(switchError as { code?: string })) log("warn", "invite.accept.switch", errorFields(switchError));
    }
  }
  redirect("/?convite=aceito");
}
