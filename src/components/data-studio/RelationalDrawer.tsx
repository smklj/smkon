"use client";

import type { RelationalDrawerContext } from "@/lib/data-studio/types";

interface RelationalDrawerProps {
  context: RelationalDrawerContext;
  onClose: () => void;
}

export function RelationalDrawer({ context, onClose }: RelationalDrawerProps) {
  if (!context.isOpen) return null;

  return (
    <div className="relational-drawer-backdrop" onClick={onClose}>
      <aside
        className="relational-drawer-panel"
        onClick={(e) => e.stopPropagation()}
        aria-label="Gaveta de Registros Relacionados"
      >
        <div className="drawer-header">
          <div className="drawer-title-group">
            <span className="drawer-icon">🔗</span>
            <div>
              <h3 className="drawer-title">{context.title}</h3>
              <p className="drawer-sub">
                Registros relacionados em <strong>{context.targetModelId}</strong> vinculados ao ID #{context.sourceRecordId}
              </p>
            </div>
          </div>
          <button
            type="button"
            className="drawer-close-btn"
            onClick={onClose}
            title="Fechar gaveta relacional"
          >
            ✕
          </button>
        </div>

        <div className="drawer-body">
          {context.records.length === 0 ? (
            <div className="drawer-empty-state">
              <p className="empty-emoji">📂</p>
              <h4>Nenhum registro relacionado encontrado</h4>
              <p>Não há itens vinculados a este registro no momento.</p>
            </div>
          ) : (
            <div className="drawer-records-list">
              {context.records.map((rec, idx) => (
                <div key={String(rec.id || idx)} className="drawer-record-card">
                  <div className="record-card-head">
                    <span className="record-id-badge">#{String(rec.id || idx + 1)}</span>
                    {Boolean(rec.status) ? (
                      <span className="record-status-pill">{String(rec.status)}</span>
                    ) : null}
                  </div>
                  <h4 className="record-card-title">
                    {String(rec.title || rec.name || rec.orderId || "Sem título")}
                  </h4>
                  <div className="record-card-meta">
                    {Object.entries(rec)
                      .filter(([k]) => !["id", "title", "name", "status"].includes(k))
                      .slice(0, 4)
                      .map(([key, val]) => (
                        <div key={key} className="meta-pair">
                          <span className="meta-k">{key}:</span>
                          <strong className="meta-v">{String(val)}</strong>
                        </div>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="drawer-footer">
          <span className="drawer-records-count">
            Total: {context.records.length} item(s) relacionado(s)
          </span>
          <button
            type="button"
            className="button button-small button-secondary"
            onClick={onClose}
          >
            Fechar Gaveta
          </button>
        </div>
      </aside>
    </div>
  );
}
