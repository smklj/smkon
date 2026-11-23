import { jsonError } from "@/lib/http/errors";
import { errorFields, log } from "@/lib/observability/log";
import { canEditContent } from "@/lib/content/service";
import { ASSIST_ERROR_MESSAGE, ASSIST_ERROR_STATUS, AssistError, assistLabel, runAssist } from "@/lib/ai/assist";
import { assistContext, loadProductFacts, readJsonBody } from "@/lib/ai/server";
import { parseWrittenDraft, WRITE_LIMITS, writerPrompts } from "@/lib/ai/content-writer";
import { ruleIssues } from "@/lib/ai/compliance";

const NO_STORE = { "Cache-Control": "private, no-store" };

/**
 * Content Studio: rascunho escrito pela IA (roteiro, legenda, CTA, hashtags) a partir do produto e das
 * evidências verificadas. Não grava nada: devolve o texto para a pessoa revisar e salvar.
 */
export async function POST(request: Request) {
  try {
    const ctx = await assistContext(request);
    if (!ctx) return jsonError(401, "not_authenticated", "Não autenticado.");
    if (!canEditContent(ctx.role as Parameters<typeof canEditContent>[0])) {
      return jsonError(403, "forbidden", "Seu papel não permite criar conteúdo.");
    }

    const body = await readJsonBody(request);
    const product = typeof body?.product === "string" ? body.product.trim().slice(0, 200) : "";
    if (!product) return jsonError(400, "invalid_input", "Informe o produto do rascunho antes de pedir à IA.");
    const channels = Array.isArray(body?.channels)
      ? body.channels.filter((value): value is string => typeof value === "string").map((value) => value.slice(0, 40)).slice(0, 8)
      : [];
    const title = typeof body?.title === "string" ? body.title.trim().slice(0, 200) : undefined;
    const angle = typeof body?.angle === "string" ? body.angle.trim().slice(0, WRITE_LIMITS.angle) : undefined;

    const facts = await loadProductFacts(ctx.supabase, ctx.organizationId, product);
    const prompts = writerPrompts({ product, title, channels, angle }, facts);
    const result = await runAssist(
      { feature: "studio_write", role: ctx.role, system: prompts.system, user: prompts.user, maxTokens: 1_400 },
      { config: ctx.config, store: ctx.store("studio_write") },
    );
    const draft = parseWrittenDraft(result.json);
    if (!draft) throw new AssistError("ai_invalid_response");

    const warnings = ruleIssues({
      title: title ?? "",
      script: draft.script,
      caption: draft.caption,
      cta: draft.cta,
      hashtags: draft.hashtags,
      revenueDomain: facts?.revenueDomain ?? null,
    });

    return Response.json(
      {
        draft,
        warnings,
        evidenceUsed: facts?.evidence.length ?? 0,
        productFound: facts !== null,
        label: assistLabel(result.model),
        model: result.model,
      },
      { headers: NO_STORE },
    );
  } catch (error) {
    if (error instanceof AssistError) {
      log("warn", "api.ai.write", { code: error.code });
      return jsonError(ASSIST_ERROR_STATUS[error.code], error.code, ASSIST_ERROR_MESSAGE[error.code]);
    }
    log("error", "api.ai.write", errorFields(error));
    return jsonError(500, "internal_error", "Não foi possível gerar o rascunho agora.");
  }
}
