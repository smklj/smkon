import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { completeMercadoLivreOAuthConnection } from "@/lib/integrations/mercado-livre/repository";
import { consumeMercadoLivreOAuthAttempt } from "@/lib/integrations/mercado-livre/oauth-attempts";
import { decryptMercadoLivreTokens, encryptMercadoLivreTokens, loadMercadoLivreTokenKeyring } from "@/lib/integrations/mercado-livre/token-crypto.server";
import { exchangeAuthorizationCode } from "@/lib/integrations/mercado-livre/oauth";
import { mercadoLivreGet } from "@/lib/integrations/mercado-livre/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const state = url.searchParams.get("state") ?? "";
  const code = url.searchParams.get("code") ?? "";
  const providerError = url.searchParams.get("error");
  if (!state || (!providerError && (!code || code.length > 2048))) {
    return NextResponse.json({ error: "Invalid Mercado Livre OAuth callback." }, { status: 400 });
  }

  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "Authentication required; restart connection." }, { status: 401 });

    const clientId = process.env.MERCADO_LIVRE_CLIENT_ID;
    const clientSecret = process.env.MERCADO_LIVRE_CLIENT_SECRET;
    const redirectUri = process.env.MERCADO_LIVRE_REDIRECT_URI;
    if (!clientId || !clientSecret || !redirectUri) {
      return NextResponse.json({ error: "Mercado Livre OAuth is not configured." }, { status: 503 });
    }

    const attempt = await consumeMercadoLivreOAuthAttempt(state, user.id);
    if (!attempt) return NextResponse.json({ error: "OAuth state expired, invalid or already used." }, { status: 400 });
    if (providerError) {
      return NextResponse.json({ error: "Mercado Livre authorization was declined. You can restart the connection flow." }, { status: 400 });
    }

    const context = {
      organizationId: attempt.organizationId,
      provider: "mercado_livre" as const,
      externalUserId: `oauth-attempt:${attempt.connectionId}`,
    };
    const keyring = loadMercadoLivreTokenKeyring();
    const verifier = decryptMercadoLivreTokens(attempt.encryptedVerifier, context, keyring);
    const tokenSet = await exchangeAuthorizationCode({ clientId, clientSecret, redirectUri }, code, verifier);

    const profile = await mercadoLivreGet<{ id: number; nickname?: string }>(tokenSet.accessToken, "/users/me");
    if (String(profile.id) !== tokenSet.userId) {
      return NextResponse.json({ error: "Authorized Mercado Livre identity could not be verified." }, { status: 409 });
    }

    const tokenContext = {
      organizationId: attempt.organizationId,
      provider: "mercado_livre" as const,
      externalUserId: tokenSet.userId,
    };
    const encryptedTokens = encryptMercadoLivreTokens(JSON.stringify(tokenSet), tokenContext, keyring);
    const sellerLabel = typeof profile.nickname === "string" && profile.nickname.trim()
      ? profile.nickname.trim().slice(0, 120)
      : String(profile.id);

    await completeMercadoLivreOAuthConnection({
      organizationId: attempt.organizationId,
      connectionId: attempt.connectionId,
      actorUserId: user.id,
      externalAccountId: tokenSet.userId,
      displayName: `Mercado Livre · ${sellerLabel}`,
      grantedScopes: tokenSet.scopes,
      encryptedTokens,
      tokenExpiresAt: tokenSet.expiresAt,
    });

    return NextResponse.redirect(new URL("/admin?mercadoLivre=connected", url.origin), {
      headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" },
    });
  } catch {
    return NextResponse.json({ error: "Mercado Livre authorization could not be completed. Restart the connection flow." }, { status: 400 });
  }
}
