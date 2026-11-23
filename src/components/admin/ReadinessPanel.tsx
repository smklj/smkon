import { Badge } from "@/components/ui/PageHeader";
import { createClient } from "@/lib/supabase/server";
import { errorFields, log } from "@/lib/observability/log";
import { findWorkspace } from "@/lib/tenancy/workspace";
import { readinessChecks, readinessSummary, type ReadinessStatus } from "@/lib/readiness/checks";

const STATUS_LABEL: Record<ReadinessStatus, string> = {
  ready: "Pronto",
  action: "Falta configurar",
  invalid: "Valor inválido",
  off: "Desligado",
};
const STATUS_TONE: Record<ReadinessStatus, "ok" | "warn" | "danger" | "neutral"> = {
  ready: "ok",
  action: "warn",
  invalid: "danger",
  off: "neutral",
};

async function canSee(): Promise<boolean> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;
    const workspace = await findWorkspace(supabase, user.id);
    return workspace?.role === "owner" || workspace?.role === "admin";
  } catch (error) {
    log("error", "admin.readiness", errorFields(error));
    return false;
  }
}

/**
 * O que está pronto e o que falta configurar neste ambiente. Só owner e admin veem.
 * Mostra apenas nomes de variáveis, nunca valores.
 */
export async function ReadinessPanel() {
  if (!(await canSee())) {
    return <p className="row-meta">Visível só para owner e admin do workspace.</p>;
  }
  const checks = readinessChecks(process.env);
  const summary = readinessSummary(checks);

  return (
    <div className="readiness">
      <p className="readiness-summary">
        <strong>{summary.ready} de {summary.total}</strong> recursos prontos neste ambiente
        {summary.pending ? ` · ${summary.pending} ${summary.pending === 1 ? "pendente" : "pendentes"}` : " · tudo configurado"}.
        Variáveis são cadastradas na Vercel (Settings → Environment Variables) e valem no próximo deploy.
      </p>
      <ul className="rows">
        {checks.map((check) => (
          <li key={check.id} className="row row-top">
            <div className="row-main">
              <p className="row-title">{check.title}</p>
              <p className="row-meta">{check.unlocks}</p>
              {check.missing.length ? (
                <p className="row-meta readiness-vars">
                  Falta: {check.missing.map((name) => <code key={name}>{name}</code>)}
                </p>
              ) : null}
              {check.invalid.length ? (
                <p className="row-meta readiness-vars">
                  Formato inválido: {check.invalid.map((name) => <code key={name}>{name}</code>)}
                </p>
              ) : null}
              {check.hint && (check.status !== "ready" || check.id === "agents" || check.id === "ai-assist") ? <p className="row-meta">{check.hint}</p> : null}
            </div>
            <Badge tone={STATUS_TONE[check.status]}>{STATUS_LABEL[check.status]}</Badge>
          </li>
        ))}
      </ul>
    </div>
  );
}
