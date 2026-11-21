import type { ColumnDefinition, DataRow, SortCriterion } from "./types.ts";

/** Texto pesquisável de uma célula. */
function cellText(value: DataRow[string]): string {
  if (value === null || value === undefined) return "";
  return Array.isArray(value) ? value.join(" ") : String(value);
}

/**
 * Busca em todas as colunas visíveis, filtro exato por uma coluna e ordenação estável.
 * Valores vazios vão sempre para o fim, nos dois sentidos.
 */
export function queryRows(
  rows: readonly DataRow[],
  options: {
    columns: readonly ColumnDefinition[];
    search?: string;
    filter?: { key: string; value: string } | null;
    sort?: SortCriterion | null;
  },
): DataRow[] {
  const search = options.search?.trim().toLocaleLowerCase("pt-BR") ?? "";
  const keys = options.columns.map((column) => column.key);

  let result = rows.filter((row) => {
    if (options.filter && options.filter.value && cellText(row[options.filter.key]) !== options.filter.value) {
      return false;
    }
    if (!search) return true;
    return keys.some((key) => cellText(row[key]).toLocaleLowerCase("pt-BR").includes(search));
  });

  if (options.sort) {
    const { column, direction } = options.sort;
    const factor = direction === "asc" ? 1 : -1;
    result = result
      .map((row, index) => ({ row, index }))
      .sort((a, b) => {
        const va = a.row[column];
        const vb = b.row[column];
        const emptyA = va === null || va === undefined || va === "";
        const emptyB = vb === null || vb === undefined || vb === "";
        if (emptyA || emptyB) return emptyA === emptyB ? a.index - b.index : emptyA ? 1 : -1;
        const compared =
          typeof va === "number" && typeof vb === "number"
            ? va - vb
            : cellText(va).localeCompare(cellText(vb), "pt-BR", { numeric: true });
        return compared === 0 ? a.index - b.index : compared * factor;
      })
      .map((item) => item.row);
  }

  return result;
}

/** Valores distintos de uma coluna, para o filtro rápido. */
export function distinctValues(rows: readonly DataRow[], key: string): string[] {
  return [...new Set(rows.map((row) => cellText(row[key])).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, "pt-BR"),
  );
}

/**
 * CSV com separador ";" (padrão do Excel em pt-BR) e proteção contra injeção de fórmula:
 * célula que começa com = + - @ ou tab ganha um apóstrofo.
 */
export function toCsv(rows: readonly DataRow[], columns: readonly ColumnDefinition[]): string {
  const escape = (raw: string): string => {
    const numeric = /^-?\d+(?:[.,]\d+)?$/.test(raw);
    const safe = !numeric && /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
    return /[";\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  const header = columns.map((column) => escape(column.label)).join(";");
  const lines = rows.map((row) => columns.map((column) => escape(cellText(row[column.key]))).join(";"));
  return [header, ...lines].join("\r\n");
}
