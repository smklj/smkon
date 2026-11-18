import { log } from "../observability/log.ts";

/** Erro de validação com mensagem segura para exibir ao usuário. */
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

type DbError = { code?: string; message?: string; details?: string; hint?: string } | null | undefined;

/** Erros de negócio levantados pelas funções do banco (raise exception '<code>'). */
const DB_BUSINESS_ERRORS: Record<string, { status: number; message: string }> = {
  not_authenticated: { status: 401, message: "Não autenticado." },
  forbidden: { status: 403, message: "Seu papel não permite esta ação." },
  content_not_found: { status: 404, message: "Conteúdo não encontrado." },
  content_archived: { status: 409, message: "Conteúdo arquivado não pode ser aprovado." },
  hash_mismatch: {
    status: 409,
    message: "O conteúdo mudou desde a revisão. Revise a versão atual antes de aprovar.",
  },
  rights_required: { status: 422, message: "Confirme os direitos de uso do vídeo de referência antes de aprovar." },
  approval_required: { status: 409, message: "A aprovação só pode ser feita pelo fluxo de aprovação." },
  invalid_role: { status: 400, message: "Papel inválido para convite." },
  invalid_email: { status: 400, message: "E-mail inválido." },
  invalid_token: { status: 400, message: "Convite inválido." },
  already_member: { status: 409, message: "Este e-mail já faz parte do workspace." },
  email_not_verified: { status: 403, message: "Confirme seu e-mail antes de aceitar o convite." },
  invitation_invalid: { status: 410, message: "Convite inválido, expirado ou já utilizado." },
  invitation_email_mismatch: { status: 403, message: "Este convite foi enviado para outro e-mail." },
  invitation_not_found: { status: 404, message: "Convite não encontrado." },
  invitation_not_pending: { status: 409, message: "Este convite não está mais pendente." },
};

/** Mensagem segura para um código de negócio conhecido (para Server Actions). */
export function businessErrorMessage(error: unknown, fallback: string): string {
  const code = (error as DbError)?.message?.trim();
  return code && code in DB_BUSINESS_ERRORS ? DB_BUSINESS_ERRORS[code].message : fallback;
}

export function jsonError(status: number, code: string, message: string) {
  // Response padrão da web: funciona em Route Handlers e em testes fora do runtime do Next.
  return Response.json({ error: message, code }, { status });
}

/**
 * Converte qualquer erro em resposta HTTP sem vazar detalhes internos.
 * Detalhes ficam só no log do servidor.
 */
export function toErrorResponse(scope: string, error: unknown, fallbackMessage: string) {
  if (error instanceof ValidationError) {
    return jsonError(400, "invalid_input", error.message);
  }

  const dbError = error as DbError;
  const businessCode = dbError?.message?.trim();
  if (businessCode && businessCode in DB_BUSINESS_ERRORS) {
    const mapped = DB_BUSINESS_ERRORS[businessCode];
    return jsonError(mapped.status, businessCode, mapped.message);
  }
  if (dbError?.code === "23503") {
    return jsonError(409, "has_dependencies", "Este registro possui histórico de aprovação. Arquive em vez de excluir.");
  }
  if (dbError?.code === "42501") {
    return jsonError(403, "forbidden", "Seu papel não permite esta ação.");
  }

  log("error", scope, {
    code: dbError?.code ?? "unknown",
    message: error instanceof Error ? error.message : dbError?.message ?? String(error),
  });
  return jsonError(500, "internal_error", fallbackMessage);
}
