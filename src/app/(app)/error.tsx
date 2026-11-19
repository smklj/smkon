"use client";

import Link from "next/link";
import { useEffect } from "react";

/** Falha inesperada ao renderizar um módulo: mensagem sem detalhes internos e caminho para tentar de novo. */
export default function ModuleError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Só o identificador vai para o console; o detalhe fica nos logs do servidor.
    if (error.digest) console.error(JSON.stringify({ level: "error", scope: "ui.module_error", digest: error.digest }));
  }, [error]);

  return (
    <div className="page">
      <section className="panel state-panel" role="alert">
        <p className="eyebrow">Erro</p>
        <h1 className="state-title">Não foi possível carregar esta tela.</h1>
        <p className="page-description">Nada foi alterado. Tente de novo em instantes; se continuar, volte à visão geral.</p>
        {error.digest ? <p className="muted">Código para suporte: {error.digest}</p> : null}
        <div className="state-actions">
          <button type="button" className="button button-primary" onClick={reset}>Tentar de novo</button>
          <Link className="button button-secondary" href="/">Visão geral</Link>
        </div>
      </section>
    </div>
  );
}
