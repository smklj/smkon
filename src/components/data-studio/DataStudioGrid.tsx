"use client";

import Link from "next/link";
import { useId, useMemo, useState } from "react";
import { Badge } from "@/components/ui/PageHeader";
import { distinctValues, queryRows, toCsv } from "@/lib/data-studio/query";
import { productKey } from "@/lib/data-studio/mappers";
import {
  DATA_MODELS,
  DATA_STUDIO_ROW_LIMIT,
  type ColumnDefinition,
  type DataModelId,
  type DataRow,
  type DataStudioPayload,
  type SortCriterion,
} from "@/lib/data-studio/types";
import { RelationalDrawer } from "./RelationalDrawer";

const dateFormat = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

function formatMoney(value: number, currency: string): string {
  try {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(value);
  } catch {
    return `${value.toFixed(2)} ${currency}`;
  }
}

function Cell({ column, row, onOpenRelation }: {
  column: ColumnDefinition;
  row: DataRow;
  onOpenRelation: (row: DataRow) => void;
}) {
  const value = row[column.key];
  const empty = <span className="ds-empty">—</span>;

  switch (column.kind) {
    case "money": {
      if (typeof value !== "number") return empty;
      const currency = String(row[column.currencyKey ?? "currency"] ?? "BRL");
      return <span className={`ds-num${value < 0 ? " ds-negative" : ""}`}>{formatMoney(value, currency)}</span>;
    }
    case "percent":
      return typeof value === "number" ? <span className="ds-num">{value.toLocaleString("pt-BR")}%</span> : empty;
    case "score":
      return typeof value === "number" ? <span className="ds-num">{Math.round(value)}</span> : <span className="ds-empty">sem score</span>;
    case "date":
      return typeof value === "string" ? <span className="ds-num">{dateFormat.format(new Date(value))}</span> : empty;
    case "badge":
      return typeof value === "string" ? <Badge tone={column.tones?.[value] ?? "neutral"}>{value}</Badge> : empty;
    case "list":
      return Array.isArray(value) && value.length ? <span className="ds-list">{value.join(" · ")}</span> : empty;
    case "relation":
      return typeof value === "number" && value > 0 ? (
        <button type="button" className="ds-relation" onClick={() => onOpenRelation(row)}>
          {value} {value === 1 ? "conteúdo" : "conteúdos"}
        </button>
      ) : (
        <span className="ds-empty">0</span>
      );
    default:
      return value === null || value === undefined || value === "" ? empty : <span>{String(value)}</span>;
  }
}

/** Explorador somente leitura dos dados reais do workspace. */
export function DataStudioGrid({ data }: { data: DataStudioPayload }) {
  const baseId = useId();
  const [modelId, setModelId] = useState<DataModelId>("products");
  const [search, setSearch] = useState("");
  const [filterValue, setFilterValue] = useState("");
  const [sort, setSort] = useState<SortCriterion | null>(null);
  const [relation, setRelation] = useState<DataRow | null>(null);

  const model = DATA_MODELS[modelId];
  const dataset = data[modelId];

  const filterOptions = useMemo(() => distinctValues(dataset.rows, model.filterKey), [dataset.rows, model.filterKey]);
  const rows = useMemo(
    () =>
      queryRows(dataset.rows, {
        columns: model.columns,
        search,
        filter: filterValue ? { key: model.filterKey, value: filterValue } : null,
        sort,
      }),
    [dataset.rows, model, search, filterValue, sort],
  );

  const relatedContents = useMemo(() => {
    if (!relation) return [];
    const key = productKey(String(relation.name ?? ""));
    return data.content.rows.filter((row) => productKey(String(row.product ?? "")) === key);
  }, [relation, data.content.rows]);

  function selectModel(next: DataModelId) {
    setModelId(next);
    setSearch("");
    setFilterValue("");
    setSort(null);
  }

  function toggleSort(column: string) {
    setSort((current) =>
      current?.column !== column
        ? { column, direction: "asc" }
        : current.direction === "asc"
          ? { column, direction: "desc" }
          : null,
    );
  }

  function exportCsv() {
    const blob = new Blob(["﻿", toCsv(rows, model.columns)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `smkon-${model.id}-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="ds">
      <div className="ds-tabs" role="tablist" aria-label="Conjuntos de dados">
        {(Object.keys(DATA_MODELS) as DataModelId[]).map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            id={`${baseId}-tab-${id}`}
            aria-selected={id === modelId}
            aria-controls={`${baseId}-panel`}
            className="ds-tab"
            onClick={() => selectModel(id)}
          >
            {DATA_MODELS[id].label}
            <span className="ds-count">
              {data[id].rows.length}
              {data[id].truncated ? "+" : ""}
            </span>
          </button>
        ))}
      </div>

      <div id={`${baseId}-panel`} role="tabpanel" aria-labelledby={`${baseId}-tab-${modelId}`}>
        <p className="ds-description">{model.description}</p>

        <div className="ds-toolbar">
          <label className="ds-search">
            <span className="sr-only">Buscar em {model.label}</span>
            <input
              type="search"
              placeholder={`Buscar em ${model.label.toLowerCase()}`}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <label className="ds-filter">
            <span className="sr-only">{model.filterLabel}</span>
            <select value={filterValue} onChange={(event) => setFilterValue(event.target.value)}>
              <option value="">{model.filterLabel}: todos</option>
              {filterOptions.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </label>
          <span className="ds-total" aria-live="polite">
            {rows.length === dataset.rows.length ? `${rows.length} registros` : `${rows.length} de ${dataset.rows.length}`}
          </span>
          <button type="button" className="button button-secondary" onClick={exportCsv} disabled={rows.length === 0}>
            Exportar CSV
          </button>
        </div>

        <div className="ds-table-wrap">
          <table className="ds-table">
            <thead>
              <tr>
                {model.columns.map((column) => {
                  const active = sort?.column === column.key;
                  return (
                    <th
                      key={column.key}
                      scope="col"
                      aria-sort={active ? (sort.direction === "asc" ? "ascending" : "descending") : "none"}
                      className={column.kind === "money" || column.kind === "percent" || column.kind === "score" ? "ds-right" : undefined}
                    >
                      <button type="button" className="ds-sort" onClick={() => toggleSort(column.key)}>
                        {column.label}
                        <span className="ds-sort-mark" aria-hidden="true">{active ? (sort.direction === "asc" ? "↑" : "↓") : ""}</span>
                      </button>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={model.columns.length} className="ds-none">
                    {dataset.rows.length === 0
                      ? `Nenhum registro em ${model.label.toLowerCase()} ainda.`
                      : "Nada encontrado com essa busca ou filtro."}
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={String(row.id)}>
                    {model.columns.map((column) => (
                      <td
                        key={column.key}
                        className={column.kind === "money" || column.kind === "percent" || column.kind === "score" ? "ds-right" : undefined}
                      >
                        <Cell column={column} row={row} onOpenRelation={setRelation} />
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <p className="ds-foot">
          Somente leitura: cada registro é editado na tela do módulo, que aplica as regras do domínio.{" "}
          <Link className="link" href={model.editHref}>{model.editLabel}</Link>
          {dataset.truncated ? ` · Mostrando os ${DATA_STUDIO_ROW_LIMIT} mais recentes.` : ""}
        </p>
      </div>

      <RelationalDrawer
        open={relation !== null}
        title={relation ? `Conteúdos de ${String(relation.name)}` : ""}
        rows={relatedContents}
        onClose={() => setRelation(null)}
      />
    </div>
  );
}
