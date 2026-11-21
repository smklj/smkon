import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { assertMercadoLivreManager } from "@/lib/integrations/mercado-livre/repository";
import { createOAuthAttempt, createCodeChallenge } from "@/lib/integrations/mercado-livre/oauth-state";
import { buildAuthorizationUrl } from "@/lib/integrations/mercado-livre/oauth-url";
import { encryptMercadoLivreTokens, loadMercadoLivreTokenKeyring } from "@/lib/integrations/mercado-livre/token-crypto.server";
import { saveMercadoLivreOAuthAttempt } from "@/lib/integrations/mercado-livre/oauth-attempts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

    const body = await request.json().catch(() => null) as { organizationId?: string; connectionId?: string } | null;
    if (!body?.organizationId || !body.connectionId) return NextResponse.json({ error: "organizationId and connectionId are required." }, { status: 400 });
    await assertMercadoLivreManager(body.organizationId);

    const { data: connection, error } = await supabase
      .from("source_connections")
      .select("id, external_account_id")
      .eq("id", body.connectionId)
      .eq("organization_id", body.organizationId)
      .eq("provider", "mercado_livre")
      .eq("domain", "owned_sales")
      .maybeSingle();
    if (error || !connection) return NextResponse.json({ error: "Mercado Livre connection not found." }, { status: 404 });

    const clientId = process.env.MERCADO_LIVRE_CLIENT_ID;
    const redirectUri = process.env.MERCADO_LIVRE_REDIRECT_URI;
    if (!clientId || !redirectUri) return NextResponse.json({ error: "Mercado Livre OAuth is not configured." }, { status: 503 });

    const attempt = createOAuthAttempt();
    const context = { organizationId: body.organizationId, provider: "mercado_livre" as const, externalUserId: `oauth-attempt:${body.connectionId}` };
    const encryptedVerifier = encryptMercadoLivreTokens(attempt.codeVerifier, context, loadMercadoLivreTokenKeyring());
    await saveMercadoLivreOAuthAttempt({
      state: attempt.state,
      organizationId: body.organizationId,
      connectionId: body.connectionId,
      userId: user.id,
      encryptedVerifier,
    });

    const authorizationUrl = buildAuthorizationUrl(
      { clientId, redirectUri },
      attempt.state,
      createCodeChallenge(attempt.codeVerifier),
    );
    return NextResponse.json({ authorizationUrl }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Could not start Mercado Livre authorization." }, { status: 400 });
  }
}
