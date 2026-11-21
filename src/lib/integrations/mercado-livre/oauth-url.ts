export function buildAuthorizationUrl(config: { clientId: string; redirectUri: string; authorizationBaseUrl?: string }, state: string, challenge: string): string {
  const url = new URL(config.authorizationBaseUrl ?? "https://auth.mercadolivre.com.br/authorization");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");
  return url.toString();
}
