"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { businessErrorMessage } from "@/lib/http/errors";
import { hashInviteToken, isWellFormedInviteToken } from "@/lib/invitations/token";

export type AcceptState = { error: string } | null;

export async function acceptInvitation(_prev: AcceptState, formData: FormData): Promise<AcceptState> {
  const token = formData.get("token");
  if (!isWellFormedInviteToken(token)) return { error: "Convite inválido, expirado ou já utilizado." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("accept_invitation", { p_token_hash: hashInviteToken(token) });
  if (error) {
    const message = businessErrorMessage(error, "Não foi possível aceitar o convite.");
    if (message === "Não foi possível aceitar o convite.") {
      console.error(JSON.stringify({ level: "error", scope: "invite.accept", code: error.code ?? "unknown" }));
    }
    return { error: message };
  }
  redirect("/?convite=aceito");
}
