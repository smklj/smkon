import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/http/safe-redirect";

const OTP_TYPES = new Set<EmailOtpType>(["invite", "recovery", "email", "magiclink", "signup", "email_change"]);

/**
 * Conclui login por e-mail.
 * - `code` (PKCE): troca por sessão.
 * - `token_hash` + `type` (template de e-mail do Supabase): verifica o OTP.
 * Convites e recuperação de senha seguem para /conta/senha.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const code = params.get("code");
  const tokenHash = params.get("token_hash");
  const type = params.get("type") as EmailOtpType | null;
  const next = safeNextPath(params.get("next"), "/");
  const failed = NextResponse.redirect(new URL("/login?error=callback-failed", request.url));

  const supabase = await createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return failed;
    return NextResponse.redirect(new URL(next, request.url));
  }

  if (tokenHash && type && OTP_TYPES.has(type)) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (error) return failed;
    const destination = type === "invite" || type === "recovery"
      ? `/conta/senha?next=${encodeURIComponent(next)}`
      : next;
    return NextResponse.redirect(new URL(destination, request.url));
  }

  return failed;
}
