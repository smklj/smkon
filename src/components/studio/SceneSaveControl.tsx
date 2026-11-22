"use client";

import { useState } from "react";
import type { SceneDocument } from "@/lib/scene/types";

/** Resposta de PUT /api/content/scene. */
export type SavedScene = {
  id: string;
  version: number;
  content_hash: string;
  status: string;
  scene: SceneDocument | null;
};

/** Peça aberta no Studio: o design é gravado nela, na versão que o editor abriu. */
export type ScenePiece = { id: string; contentHash: string; approved: boolean };

type Props = {
  piece: ScenePiece | null;
  /** Monta o documento de cena do que está na tela, no momento do clique. */
  buildScene: () => SceneDocument;
  onSaved: (saved: SavedScene) => void;
  /** Rótulo do botão: "capa", "carrossel"... */
  what: string;
};

export function SceneSaveControl({ piece, buildScene, onSaved, what }: Props) {
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  if (!piece) {
    return (
      <p className="scene-save-hint" role="note">
        Salve a peça (briefing acima) para guardar o design nela.
      </p>
    );
  }

  async function save() {
    if (!piece) return;
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/content/scene", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: piece.id, scene: buildScene(), expectedHash: piece.contentHash }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Não foi possível salvar o design.");
      const saved = body as SavedScene;
      onSaved(saved);
      setMessage({ tone: "ok", text: `Design salvo na peça (versão ${saved.version}).` });
    } catch (err) {
      setMessage({ tone: "error", text: err instanceof Error ? err.message : "Não foi possível salvar o design." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="scene-save">
      <button type="button" className="btn-canvas-action primary" onClick={save} disabled={saving}>
        {saving ? "Salvando…" : `Salvar ${what} na peça`}
      </button>
      <p className="scene-save-hint">
        {piece.approved
          ? "A peça está aprovada: salvar o design cria uma versão nova, que volta para rascunho e precisa de nova aprovação."
          : "Salvar o design cria uma versão nova da peça."}
      </p>
      {message && (
        <p className={message.tone === "ok" ? "scene-save-ok" : "scene-save-error"} aria-live="polite">
          {message.text}
        </p>
      )}
    </div>
  );
}
