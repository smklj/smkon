/** Tipos do adapter Mercado Livre. Nunca importar este módulo em componentes client. */

export type MercadoLivreTokenSet = {
  accessToken: string;
  refreshToken: string;
  tokenType: "bearer";
  expiresAt: string;
  userId: string;
  scopes: string[];
};

export type MercadoLivreOAuthConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  authorizationBaseUrl?: string;
  apiBaseUrl?: string;
};

export type MercadoLivreApiErrorCode =
  | "unauthorized"
  | "forbidden"
  | "rate_limited"
  | "upstream"
  | "timeout"
  | "invalid_response";

export class MercadoLivreApiError extends Error {
  constructor(
    public readonly code: MercadoLivreApiErrorCode,
    public readonly status?: number,
  ) {
    super("Mercado Livre API request failed.");
    this.name = "MercadoLivreApiError";
  }
}

export type MercadoLivreTokenResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
  user_id: number;
  scope?: string;
};
