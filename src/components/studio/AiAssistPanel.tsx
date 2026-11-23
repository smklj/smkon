"use client";

import { useId, useState } from "react";
import { Badge } from "@/components/ui/PageHeader";
import { ISSUE_TYPE_LABEL, type ComplianceIssue } from "@/lib/ai/compliance";
import type { WrittenDraft } from "@/lib/ai/content-writer";

type DraftFields = {
  title: string;
  product: string;
  script: string;
  caption: string;
  cta: string;
  hashtags: string;
  channels: string[];
};

type ReviewState = { issues: ComplianceIssue[]; aiUsed: boolean; label: string; message?: string };

async function postJson<T>(url: string, body: unknown): Promise<{ ok: true; data: T } | { ok: false; message: string }> {
  try {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => null);
    if (!res.ok) return { ok: false, message: (data as { error?: string } | null)?.error ?? "Não foi possível falar com a IA agora." };
    return { ok: true, data: data as T };
  } catch {
    return { ok: false, message: "Sem conexão. Tente de novo." };
  }
}

/**
 * IA no Content Studio: escreve o rascunho a partir do produto e das evidências verificadas, e revisa a
 * conformidade (promessa de renda, alegações, #publi, direito autoral). Nada é salvo nem aprovado aqui.
 */
export function AiAssistPanel({ draft, hasWriting, canWrite, disabled, onApply }: {
  draft: DraftFields;
  hasWriting: boolean;
  canWrite: boolean;
  disabled: boolean;
  onApply: (fields: Pick<WrittenDraft, "script" | "caption" | "cta" | "hashtags">) => void;
}) {
  const id = useId();
  const [angle, setAngle] = useState("");
  const [busy, setBusy] = useState<"write" | "review" | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState<{ tone: "info" | "error"; text: string } | null>(null);
  const [notes, setNotes] = useState<string[]>([]);
  const [review, setReview] = useState<ReviewState | null>(null);

  async function write() {
    if (!draft.product.trim()) {
      setMessage({ tone: "error", text: "Informe o produto do rascunho antes de pedir à IA." });
      return;
    }
    if (hasWriting && !confirming) {
      setConfirming(true);
      return;
    }
    setConfirming(false);
    setBusy("write");
    setMessage(null);
    const result = await postJson<{
      draft: WrittenDraft;
      warnings: ComplianceIssue[];
      evidenceUsed: number;
      productFound: boolean;
      label: string;
    }>("/api/ai/content/write", { product: draft.product, title: draft.title, channels: draft.channels, angle });
    setBusy(null);
    if (!result.ok) {
      setMessage({ tone: "error", text: result.message });
      return;
    }
    const { draft: written, warnings, evidenceUsed, productFound, label } = result.data;
    onApply({ script: written.script, caption: written.caption, cta: written.cta, hashtags: written.hashtags });
    setNotes(written.notes);
    setReview(warnings.length ? { issues: warnings, aiUsed: false, label } : null);
    setMessage({
      tone: "info",
      text: productFound
        ? `${label} escreveu o rascunho com ${evidenceUsed} ${evidenceUsed === 1 ? "evidência verificada" : "evidências verificadas"}. Revise antes de salvar e aprovar.`
        : `${label} escreveu o rascunho, mas o produto não está no catálogo: os dados ficaram entre colchetes. Revise antes de aprovar.`,
    });
  }

  async function runReview() {
    if (!draft.script.trim() && !draft.caption.trim()) {
      setMessage({ tone: "error", text: "Escreva o roteiro ou a legenda antes de revisar." });
      return;
    }
    setBusy("review");
    setMessage(null);
    const result = await postJson<{ issues: ComplianceIssue[]; ai: { used: boolean; label: string; message?: string } }>(
      "/api/ai/content/review",
      { title: draft.title, product: draft.product, script: draft.script, caption: draft.caption, cta: draft.cta, hashtags: draft.hashtags },
    );
    setBusy(null);
    if (!result.ok) {
      setMessage({ tone: "error", text: result.message });
      return;
    }
    setReview({ issues: result.data.issues, aiUsed: result.data.ai.used, label: result.data.ai.label, message: result.data.ai.message });
  }

  const blocking = review?.issues.filter((issue) => issue.severity === "bloqueio").length ?? 0;

  return (
    <section className="ai-assist" aria-labelledby={`${id}-title`}>
      <div className="ai-assist-head">
        <p id={`${id}-title`} className="ai-assist-title">
          <span className="ai-assist-mark" aria-hidden="true">✦</span> Assistente de IA
        </p>
        <span className="studio-muted">Gemini · nada é salvo nem aprovado sem você</span>
      </div>

      {canWrite ? (
        <label className="ai-assist-field" htmlFor={`${id}-angle`}>
          Ângulo ou objetivo (opcional)
          <input
            id={`${id}-angle`}
            value={angle}
            maxLength={300}
            onChange={(event) => setAngle(event.target.value)}
            placeholder="Ex.: review honesta para quem trabalha em casa"
            disabled={disabled || busy !== null}
          />
        </label>
      ) : null}

      <div className="ai-assist-actions">
        {canWrite ? (
          <button type="button" className="button button-secondary" onClick={write} disabled={disabled || busy !== null}>
            {busy === "write" ? "Escrevendo…" : confirming ? "Confirmar e substituir o texto" : "Escrever com IA"}
          </button>
        ) : null}
        {confirming ? (
          <button type="button" className="button button-ghost" onClick={() => setConfirming(false)}>
            Cancelar
          </button>
        ) : null}
        <button type="button" className="button button-secondary" onClick={runReview} disabled={disabled || busy !== null}>
          {busy === "review" ? "Revisando…" : "Revisar conformidade"}
        </button>
      </div>

      {confirming ? (
        <p className="studio-muted ai-assist-hint">A IA substitui roteiro, legenda, CTA e hashtags deste rascunho.</p>
      ) : null}

      <div aria-live="polite">
        {message ? (
          <p className={`ai-assist-message ${message.tone === "error" ? "is-error" : ""}`}>{message.text}</p>
        ) : null}
      </div>

      {notes.length ? (
        <div className="ai-assist-notes">
          <p className="ai-assist-subtitle">Para conferir</p>
          <ul>
            {notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {review ? (
        <div className="ai-assist-review">
          <p className="ai-assist-subtitle">
            {review.issues.length === 0
              ? "Nenhum problema encontrado"
              : `${review.issues.length} ${review.issues.length === 1 ? "ponto" : "pontos"} de conformidade${blocking ? ` · ${blocking} ${blocking === 1 ? "bloqueio" : "bloqueios"}` : ""}`}
            <span className="studio-muted"> · {review.aiUsed ? `regras + ${review.label}` : "só regras automáticas"}</span>
          </p>
          {review.message ? <p className="studio-muted">{review.message}</p> : null}
          {review.issues.length ? (
            <ul className="ai-issues">
              {review.issues.map((issue, index) => (
                <li key={`${issue.type}-${index}`} className={`ai-issue ai-issue-${issue.severity}`}>
                  <div className="ai-issue-head">
                    <Badge tone={issue.severity === "bloqueio" ? "danger" : "warn"}>
                      {issue.severity === "bloqueio" ? "Bloqueio" : "Atenção"}
                    </Badge>
                    <span className="ai-issue-type">{ISSUE_TYPE_LABEL[issue.type]}</span>
                  </div>
                  {issue.excerpt ? <p className="ai-issue-excerpt">“{issue.excerpt}”</p> : null}
                  <p className="row-meta">{issue.why}</p>
                  {issue.suggestion ? <p className="row-meta">Como corrigir: {issue.suggestion}</p> : null}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
