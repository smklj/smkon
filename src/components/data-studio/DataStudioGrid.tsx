"use client";

import { useMemo, useState } from "react";
import {
  SMKON_MODELS,
  type ColumnDefinition,
  type FilterCriterion,
  type ModelDefinition,
  type RelationalDrawerContext,
  type SortCriterion,
} from "@/lib/data-studio/types";
import {
  applyAddRecord,
  applyDeleteRecord,
  applyFieldEdit,
  computeStagingSummary,
  createInitialStagingState,
  discardAll,
  filterAndSortRecords,
  getRecordMergedValue,
  getRecordStatus,
} from "@/lib/data-studio/staging-engine";
import { RelationalDrawer } from "./RelationalDrawer";

// Dados iniciais de demonstração e homologação para cada modelo
const INITIAL_MOCK_DATA: Record<string, Record<string, unknown>[]> = {
  products: [
    {
      id: "prod-101",
      name: "Mini Aspirador Portátil Sem Fio",
      price: 39.9,
      commissionRate: 15,
      category: "utilidades",
      source: "shopee",
      status: "active",
      score: 9.6,
      contentsCount: 4,
    },
    {
      id: "prod-102",
      name: "Teclado Mecânico RGB Hot-Swap",
      price: 69.9,
      commissionRate: 12,
      category: "perifericos",
      source: "shopee",
      status: "active",
      score: 9.8,
      contentsCount: 3,
    },
    {
      id: "prod-103",
      name: "Conjunto Alfaiataria Elegance",
      price: 89.9,
      commissionRate: 20,
      category: "moda",
      source: "shein",
      status: "active",
      score: 9.2,
      contentsCount: 2,
    },
    {
      id: "prod-104",
      name: "Manual dos Achadinhos Virais 2026",
      price: 47.0,
      commissionRate: 80,
      category: "infoprodutos",
      source: "kiwify",
      status: "active",
      score: 9.9,
      contentsCount: 5,
    },
    {
      id: "prod-105",
      name: "Fone Bluetooth ANC com Display LED",
      price: 79.9,
      commissionRate: 10,
      category: "perifericos",
      source: "shopee",
      status: "review",
      score: 8.9,
      contentsCount: 1,
    },
  ],

  content: [
    {
      id: "cont-201",
      title: "Achadinho Shopee: Mini Aspirador Portátil",
      productName: "Mini Aspirador Portátil Sem Fio",
      channel: "Instagram / TikTok",
      status: "Aprovado",
      promoCode: "SHOPEE20",
      viewsEstimated: 128000,
    },
    {
      id: "cont-202",
      title: "TOP 5 Periféricos até R$300",
      productName: "Teclado Mecânico RGB Hot-Swap",
      channel: "YouTube / Reels",
      status: "Aprovado",
      promoCode: "SMKON10",
      viewsEstimated: 340000,
    },
    {
      id: "cont-203",
      title: "Review Completo: Vale a Pena?",
      productName: "Fone Bluetooth ANC com Display LED",
      channel: "TikTok / Shorts",
      status: "Rascunho",
      promoCode: "ANC15",
      viewsEstimated: 95000,
    },
  ],

  transactions: [
    {
      id: "tx-301",
      orderId: "PED-98412",
      platform: "shopee",
      grossAmount: 79.8,
      commissionAmount: 11.97,
      status: "approved",
      date: "2026-11-20",
    },
    {
      id: "tx-302",
      orderId: "PED-98415",
      platform: "kiwify",
      grossAmount: 47.0,
      commissionAmount: 37.6,
      status: "approved",
      date: "2026-11-21",
    },
    {
      id: "tx-303",
      orderId: "PED-98420",
      platform: "shein",
      grossAmount: 179.8,
      commissionAmount: 35.96,
      status: "pending",
      date: "2026-11-21",
    },
  ],
};

export function DataStudioGrid() {
  const [activeModelId, setActiveModelId] = useState<string>("products");
  const [stagingState, setStagingState] = useState(createInitialStagingState);
  const [searchQuery, setSearchQuery] = useState("");
  const [sort, setSort] = useState<SortCriterion | undefined>({ column: "id", direction: "asc" });
  const [filters] = useState<FilterCriterion[]>([]);
  const [editingCell, setEditingCell] = useState<{ recordId: string; columnKey: string } | null>(null);
  const [editValue, setEditValue] = useState<string>("");
  const [saveNotice, setSaveNotice] = useState<string>("");

  // Estado da Gaveta Relacional
  const [drawerContext, setDrawerContext] = useState<RelationalDrawerContext>({
    isOpen: false,
    sourceModelId: "",
    sourceRecordId: "",
    targetModelId: "",
    title: "",
    records: [],
  });

  const activeModel: ModelDefinition = SMKON_MODELS[activeModelId] || SMKON_MODELS.products;

  // Combina registros originais com registros criados no staging
  const allModelRecords = useMemo(() => {
    const original = INITIAL_MOCK_DATA[activeModelId] || [];
    const created = stagingState.createdRecords[activeModelId] || [];
    return [...created, ...original];
  }, [activeModelId, stagingState.createdRecords]);

  // Aplica modificações em staging e depois filtros/ordenação
  const displayedRecords = useMemo(() => {
    const withMergedValues = allModelRecords.map((rec) =>
      getRecordMergedValue(stagingState, activeModelId, rec)
    );
    return filterAndSortRecords(withMergedValues, filters, sort, searchQuery);
  }, [allModelRecords, stagingState, activeModelId, filters, sort, searchQuery]);

  const stagingSummary = useMemo(() => {
    return computeStagingSummary(stagingState);
  }, [stagingState]);

  // Alternar ordenação de coluna
  const handleSortColumn = (columnKey: string) => {
    if (sort?.column === columnKey) {
      setSort({
        column: columnKey,
        direction: sort.direction === "asc" ? "desc" : "asc",
      });
    } else {
      setSort({ column: columnKey, direction: "asc" });
    }
  };

  // Iniciar edição inline em célula
  const handleStartEdit = (recordId: string, col: ColumnDefinition, currentValue: unknown) => {
    if (col.readOnly) return;
    setEditingCell({ recordId, columnKey: col.key });
    setEditValue(String(currentValue ?? ""));
  };

  // Confirmar edição inline
  const handleConfirmEdit = (recordId: string, col: ColumnDefinition, oldValue: unknown) => {
    if (!editingCell) return;
    let finalValue: unknown = editValue;

    if (col.type === "number" || col.type === "currency") {
      const parsed = parseFloat(editValue.replace("R$", "").replace(",", ".").trim());
      finalValue = isNaN(parsed) ? oldValue : parsed;
    }

    setStagingState((prev) =>
      applyFieldEdit(prev, activeModelId, recordId, col.key, oldValue, finalValue)
    );
    setEditingCell(null);
  };

  // Cancelar edição inline
  const handleCancelEdit = () => {
    setEditingCell(null);
  };

  // Adicionar novo registro ao staging
  const handleAddNewRow = () => {
    const newId = `${activeModelId.slice(0, 4)}-${Date.now().toString().slice(-4)}`;
    const template: Record<string, unknown> = { id: newId };

    for (const col of activeModel.columns) {
      if (col.key === "id") continue;
      if (col.type === "currency" || col.type === "number") template[col.key] = 0;
      else if (col.type === "enum" && col.options) template[col.key] = col.options[0].value;
      else if (col.type === "relation") template[col.key] = 0;
      else template[col.key] = "Novo Registro";
    }

    setStagingState((prev) => applyAddRecord(prev, activeModelId, template));
  };

  // Marcar registro para exclusão (ou desfazer)
  const handleDeleteRow = (recordId: string) => {
    setStagingState((prev) => applyDeleteRecord(prev, activeModelId, recordId));
  };

  // Abrir gaveta relacional ao clicar em chip
  const handleOpenRelationDrawer = (recordId: string, col: ColumnDefinition) => {
    const targetModel = col.relationTargetModel || "content";
    const related = INITIAL_MOCK_DATA[targetModel] || [];

    setDrawerContext({
      isOpen: true,
      sourceModelId: activeModelId,
      sourceRecordId: recordId,
      targetModelId: targetModel,
      title: `${SMKON_MODELS[targetModel]?.label || targetModel} de #${recordId}`,
      records: related,
    });
  };

  // Descartar todas as alterações do staging
  const handleDiscardAll = () => {
    setStagingState(discardAll());
    setSaveNotice("Alterações descartadas com sucesso.");
    setTimeout(() => setSaveNotice(""), 3000);
  };

  // Salvar (Commit em Lote)
  const handleCommitBatch = () => {
    setSaveNotice(
      `✓ ${stagingSummary.totalChanges} alterações comitadas com sucesso na transação!`
    );
    setStagingState(createInitialStagingState());
    setTimeout(() => setSaveNotice(""), 4000);
  };

  // Exportar dados atuais em CSV
  const handleExportCsv = () => {
    if (displayedRecords.length === 0) return;
    const headers = activeModel.columns.map((c) => c.label).join(",");
    const rows = displayedRecords.map((r) =>
      activeModel.columns
        .map((c) => {
          const v = r[c.key];
          return `"${String(v ?? "").replace(/"/g, '""')}"`;
        })
        .join(",")
    );
    const csvContent = [headers, ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `smkon-${activeModelId}-${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="data-studio-wrapper">
      {/* 1. Barra de Navegação de Modelos (Prisma Studio Tabs) */}
      <div className="data-studio-model-tabs">
        {Object.values(SMKON_MODELS).map((mod) => (
          <button
            key={mod.id}
            type="button"
            className={`model-tab-btn ${activeModelId === mod.id ? "active" : ""}`}
            onClick={() => {
              setActiveModelId(mod.id);
              setEditingCell(null);
            }}
          >
            <span className="mod-icon">{mod.icon}</span>
            <span className="mod-label">{mod.label}</span>
            <span className="mod-count">
              {INITIAL_MOCK_DATA[mod.id]?.length || 0}
            </span>
          </button>
        ))}
      </div>

      {/* 2. Barra de Ferramentas (Busca, Ações & Exportação) */}
      <div className="data-studio-toolbar">
        <div className="toolbar-search-box">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            placeholder={`Buscar em ${activeModel.label}...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              type="button"
              className="clear-search-btn"
              onClick={() => setSearchQuery("")}
            >
              ✕
            </button>
          )}
        </div>

        <div className="toolbar-actions">
          <button
            type="button"
            className="btn-toolbar-action"
            onClick={handleAddNewRow}
            title="Adicionar nova linha ao buffer de staging"
          >
            ➕ Nova Linha
          </button>
          <button
            type="button"
            className="btn-toolbar-action"
            onClick={handleExportCsv}
            title="Exportar registros filtrados para arquivo CSV"
          >
            📥 Exportar CSV
          </button>
        </div>
      </div>

      {/* Aviso de feedback */}
      {saveNotice && (
        <div className="studio-feedback-banner" role="status">
          {saveNotice}
        </div>
      )}

      {/* 3. Tabela Spreadsheet Data Grid */}
      <div className="data-studio-table-stage">
        <table className="data-studio-table">
          <thead>
            <tr>
              <th className="th-status" title="Status de alteração no staging">
                Diff
              </th>
              {activeModel.columns.map((col) => (
                <th
                  key={col.key}
                  className={`th-column ${sort?.column === col.key ? "sorted" : ""}`}
                  onClick={() => handleSortColumn(col.key)}
                >
                  <div className="th-content">
                    <span>{col.label}</span>
                    <span className="sort-indicator">
                      {sort?.column === col.key ? (sort.direction === "asc" ? "▲" : "▼") : "↕"}
                    </span>
                  </div>
                </th>
              ))}
              <th className="th-actions">Ações</th>
            </tr>
          </thead>

          <tbody>
            {displayedRecords.length === 0 ? (
              <tr>
                <td colSpan={activeModel.columns.length + 2} className="td-empty">
                  Nenhum registro encontrado para a busca ou filtro selecionado.
                </td>
              </tr>
            ) : (
              displayedRecords.map((row) => {
                const recId = String(row.id);
                const status = getRecordStatus(stagingState, activeModelId, recId);
                const isDeleted = status === "deleted";

                return (
                  <tr key={recId} className={`data-row status-${status}`}>
                    {/* Indicador de Status Visual do Staging */}
                    <td className="td-status-indicator">
                      {status === "modified" && <span className="status-badge-mod" title="Modificado no staging">✏️</span>}
                      {status === "created" && <span className="status-badge-new" title="Novo registro">➕</span>}
                      {status === "deleted" && <span className="status-badge-del" title="Marcado para exclusão">🗑️</span>}
                      {status === "pristine" && <span className="status-badge-clean" title="Sincronizado com o banco">•</span>}
                    </td>

                    {/* Células de Dados Tipadas */}
                    {activeModel.columns.map((col) => {
                      const val = row[col.key];
                      const isEditing = editingCell?.recordId === recId && editingCell?.columnKey === col.key;

                      return (
                        <td
                          key={col.key}
                          className={`td-cell cell-${col.type} ${col.readOnly ? "readonly" : "editable"} ${
                            isEditing ? "editing" : ""
                          }`}
                          onDoubleClick={() => handleStartEdit(recId, col, val)}
                        >
                          {isEditing ? (
                            <div className="cell-editor-container">
                              {col.type === "enum" && col.options ? (
                                <select
                                  autoFocus
                                  value={editValue}
                                  onChange={(e) => setEditValue(e.target.value)}
                                  onBlur={() => handleConfirmEdit(recId, col, val)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") handleConfirmEdit(recId, col, val);
                                    if (e.key === "Escape") handleCancelEdit();
                                  }}
                                >
                                  {col.options.map((opt) => (
                                    <option key={opt.value} value={opt.value}>
                                      {opt.label}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <input
                                  autoFocus
                                  type={col.type === "number" || col.type === "currency" ? "number" : "text"}
                                  value={editValue}
                                  onChange={(e) => setEditValue(e.target.value)}
                                  onBlur={() => handleConfirmEdit(recId, col, val)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") handleConfirmEdit(recId, col, val);
                                    if (e.key === "Escape") handleCancelEdit();
                                  }}
                                />
                              )}
                            </div>
                          ) : col.type === "relation" ? (
                            /* Chip Relacional (Prisma Studio Style) */
                            <button
                              type="button"
                              className="relation-chip-btn"
                              onClick={() => handleOpenRelationDrawer(recId, col)}
                              title="Abrir registros vinculados na gaveta lateral"
                            >
                              🔗 {String(val)} itens
                            </button>
                          ) : col.type === "currency" ? (
                            /* Moeda BRL */
                            <span className="currency-val">
                              {typeof val === "number"
                                ? val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
                                : String(val ?? "R$ 0,00")}
                            </span>
                          ) : col.type === "enum" && col.options ? (
                            /* Enum Pill */
                            <span className={`enum-pill tone-${col.options.find((o) => o.value === val)?.tone || "neutral"}`}>
                              {col.options.find((o) => o.value === val)?.label || String(val)}
                            </span>
                          ) : (
                            /* Texto / Número Comum */
                            <span className={`cell-text ${isDeleted ? "deleted-text" : ""}`}>
                              {String(val ?? "")}
                            </span>
                          )}
                        </td>
                      );
                    })}

                    {/* Ações da Linha */}
                    <td className="td-row-actions">
                      <button
                        type="button"
                        className={`btn-row-del ${isDeleted ? "active" : ""}`}
                        onClick={() => handleDeleteRow(recId)}
                        title={isDeleted ? "Desfazer exclusão" : "Marcar para exclusão"}
                      >
                        {isDeleted ? "↩️ Restaurar" : "🗑️"}
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* 4. Barra de Ação Flutuante do Staging Buffer (Unsaved Changes) */}
      {stagingSummary.totalChanges > 0 && (
        <div className="data-studio-staging-bar">
          <div className="staging-bar-info">
            <span className="staging-warning-icon">⚠️</span>
            <span className="staging-count-text">
              <strong>{stagingSummary.totalChanges} alteração(ões) pendente(s)</strong>
              {" · "}
              {stagingSummary.editsCount > 0 && `${stagingSummary.editsCount} edição(ões) `}
              {stagingSummary.createsCount > 0 && `${stagingSummary.createsCount} nova(s) linha(s) `}
              {stagingSummary.deletesCount > 0 && `${stagingSummary.deletesCount} exclusão(ões)`}
            </span>
          </div>

          <div className="staging-bar-actions">
            <button
              type="button"
              className="btn-staging-discard"
              onClick={handleDiscardAll}
            >
              Descartar tudo
            </button>
            <button
              type="button"
              className="btn-staging-commit"
              onClick={handleCommitBatch}
            >
              💾 Salvar {stagingSummary.totalChanges} alterações
            </button>
          </div>
        </div>
      )}

      {/* 5. Gaveta Relacional Lateral (Drawer) */}
      <RelationalDrawer
        context={drawerContext}
        onClose={() => setDrawerContext({ ...drawerContext, isOpen: false })}
      />
    </div>
  );
}
