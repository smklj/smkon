"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { businessErrorMessage } from "@/lib/http/errors";
import { hashInviteToken, isWellFormedInviteToken } from "@/lib/invitations/token";
import { consumeRateLimit } from "@/lib/http/rate-limit";
import { log } from "@/lib/observability/log";

export type AcceptState = { error: string } | null;

export async function acceptInvitation(_prev: AcceptState, formData: FormData): Promise<AcceptState> {
  const token = formData.get("token");
  if (!isWellFormedInviteToken(token)) return { error: "Convite inválido, expirado ou já utilizado." };

  const supabase = await createClient();
  const limit = await consumeRateLimit(supabase, "invite_accept");
  if (!limit.allowed) return { error: "Muitas tentativas. Aguarde alguns minutos e tente novamente." };

  const { error } = await supabase.rpc("accept_invitation", { p_token_hash: hashInviteToken(token) });
  if (error) {
    const message = businessErrorMessage(error, "Não foi possível aceitar o convite.");
    if (message === "Não foi possível aceitar o convite.") {
      log("error", "invite.accept", { code: error.code ?? "unknown" });
    }
    return { error: message };
  }
  redirect("/?convite=aceito");
}
