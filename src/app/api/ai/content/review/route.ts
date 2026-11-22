import { jsonError } from "@/lib/http/errors";
import { errorFields, log } from "@/lib/observability/log";
import { ASSIST_ERROR_MESSAGE, AssistError, assistLabel, runAssist } from "@/lib/ai/assist";
import { assistContext, loadProductFacts, readJsonBody } from "@/lib/ai/server";
import { mergeIssues, parseAiIssues, reviewPrompts, ruleIssues, type ReviewInput } from "@/lib/ai/compliance";

const NO_STORE = { "Cache-Control": "private, no-store" };

const field = (body: Record<string, unknown> | null, key: string, max: number) =>
  typeof body?.[key] === "string" ? (body[key] as string).slice(0, max) : "";

/**
 * Jurídico/compliance: revisão do conteúdo. As regras determinísticas sempre rodam; a revisão da IA entra
 * quando estiver configurada. Só aponta problemas, não altera nada.
 */
export async function POST(request: Request) {
  try {
    const ctx = await assistContext(request);
    if (!ctx) return jsonError(401, "not_authenticated", "Não autenticado.");

    const body = await readJsonBody(request);
    const product = field(body, "product", 200).trim();
    const facts = product ? await loadProductFacts(ctx.supabase, ctx.organizationId, product) : null;
    const input: ReviewInput = {
      title: field(body, "title", 200),
      script: field(body, "script", 4000),
      caption: field(body, "caption", 2200),
      cta: field(body, "cta", 200),
      hashtags: field(body, "hashtags", 500),
      revenueDomain: facts?.revenueDomain ?? null,
    };
    if (!input.script.trim() && !input.caption.trim()) {
      return jsonError(400, "invalid_input", "Escreva o roteiro ou a legenda antes de revisar.");
    }

    const rules = ruleIssues(input);
    let ai: { used: boolean; label: string; message?: string } = { used: false, label: "IA" };
    let aiIssues: ReturnType<typeof parseAiIssues> = [];
    try {
      const prompts = reviewPrompts(input, facts ?? { aviso: "Produto não encontrado no catálogo." });
      const result = await runAssist(
        { feature: "compliance_review", role: ctx.role, system: prompts.system, user: prompts.user, maxTokens: 1_000 },
        { config: ctx.config, store: ctx.store("compliance_review") },
      );
      aiIssues = parseAiIssues(result.json);
      ai = { used: true, label: assistLabel(result.model) };
    } catch (error) {
      if (!(error instanceof AssistError)) throw error;
      // Sem IA (não configurada, teto, limite), a revisão continua só com as regras.
      ai = { used: false, label: "IA", message: ASSIST_ERROR_MESSAGE[error.code] };
      log("warn", "api.ai.review", { code: error.code });
    }

    return Response.json({ issues: mergeIssues(rules, aiIssues), ai }, { headers: NO_STORE });
  } catch (error) {
    log("error", "api.ai.review", errorFields(error));
    return jsonError(500, "internal_error", "Não foi possível revisar o conteúdo agora.");
  }
}
