/**
 * SMKON Data Studio — explorador de dados reais do workspace, somente leitura.
 *
 * Edição continua nas telas de cada módulo, que aplicam as regras do domínio
 * (score calculado por evidência, aprovação pelo hash, ledger imutável). Uma planilha
 * que grava direto nas tabelas contornaria essas regras.
 */

export type ColumnKind = "text" | "money" | "percent" | "score" | "date" | "badge" | "list" | "relation";

export type ColumnDefinition = {
  key: string;
  label: string;
  kind: ColumnKind;
  /** Para "money": chave da moeda na mesma linha. */
  currencyKey?: string;
  /** Para "badge": tom por valor. */
  tones?: Record<string, "ok" | "warn" | "danger" | "info" | "neutral">;
  /** Para "relation": modelo de destino. */
  relationModel?: DataModelId;
};

export type DataModelId = "products" | "content" | "ledger";

export type ModelDefinition = {
  id: DataModelId;
  label: string;
  description: string;
  /** Tela onde o registro é editado. */
  editHref: string;
  editLabel: string;
  /** Coluna usada no filtro rápido. */
  filterKey: string;
  filterLabel: string;
  columns: ColumnDefinition[];
};

export type DataRow = Record<string, string | number | null | string[]>;

export type Dataset = {
  rows: DataRow[];
  /** true quando há mais registros que o limite carregado. */
  truncated: boolean;
};

export type DataStudioPayload = Record<DataModelId, Dataset>;

export type SortCriterion = { column: string; direction: "asc" | "desc" };

export const DATA_STUDIO_ROW_LIMIT = 500;

export const DATA_MODELS: Record<DataModelId, ModelDefinition> = {
  products: {
    id: "products",
    label: "Produtos",
    description: "Catálogo do workspace com score calculado só a partir de evidências verificadas.",
    editHref: "/produtos",
    editLabel: "Editar em Produtos",
    filterKey: "status",
    filterLabel: "Status",
    columns: [
      { key: "name", label: "Produto", kind: "text" },
      { key: "source", label: "Origem", kind: "text" },
      { key: "type", label: "Tipo", kind: "text" },
      { key: "domain", label: "Domínio", kind: "text" },
      { key: "price", label: "Preço", kind: "money", currencyKey: "currency" },
      { key: "commission", label: "Comissão", kind: "percent" },
      { key: "score", label: "Score", kind: "score" },
      {
        key: "status",
        label: "Status",
        kind: "badge",
        tones: { Descoberto: "info", Selecionado: "warn", Ativo: "ok", Arquivado: "neutral" },
      },
      { key: "contents", label: "Conteúdos", kind: "relation", relationModel: "content" },
      { key: "updated_at", label: "Atualizado", kind: "date" },
    ],
  },
  content: {
    id: "content",
    label: "Conteúdos",
    description: "Peças do Content Studio com a versão atual e a versão aprovada.",
    editHref: "/studio",
    editLabel: "Editar no Content Studio",
    filterKey: "status",
    filterLabel: "Status",
    columns: [
      { key: "title", label: "Título", kind: "text" },
      { key: "product", label: "Produto", kind: "text" },
      { key: "channels", label: "Canais", kind: "list" },
      {
        key: "status",
        label: "Status",
        kind: "badge",
        tones: { Rascunho: "warn", Aprovado: "ok", Arquivado: "neutral" },
      },
      { key: "version", label: "Versão", kind: "text" },
      { key: "approved_version", label: "Aprovada", kind: "text" },
      { key: "updated_at", label: "Atualizado", kind: "date" },
    ],
  },
  ledger: {
    id: "ledger",
    label: "Lançamentos",
    description: "Ledger financeiro imutável. Domínios nunca são somados entre si.",
    editHref: "/financeiro",
    editLabel: "Ver no Financeiro",
    filterKey: "domain",
    filterLabel: "Domínio",
    columns: [
      { key: "effective_at", label: "Data", kind: "date" },
      {
        key: "domain",
        label: "Domínio",
        kind: "badge",
        tones: { "Venda própria": "ok", Afiliado: "info", "Mídia paga": "warn" },
      },
      { key: "entry_type", label: "Lançamento", kind: "text" },
      { key: "amount", label: "Valor", kind: "money", currencyKey: "currency" },
      { key: "source", label: "Origem", kind: "text" },
    ],
  },
};

export const LEDGER_ENTRY_LABEL: Record<string, string> = {
  ad_spend: "Gasto com mídia",
  sales_gross: "Venda bruta",
  sales_discount: "Desconto",
  sales_fee: "Taxa",
  sales_shipping: "Frete",
  sales_refund: "Reembolso",
  affiliate_commission_pending: "Comissão prevista",
  affiliate_commission_approved: "Comissão aprovada",
  affiliate_commission_settled: "Comissão liquidada",
  affiliate_commission_paid: "Comissão paga",
  affiliate_commission_cancelled: "Comissão cancelada",
  affiliate_commission_reversed: "Comissão estornada",
};

export const LEDGER_SOURCE_LABEL: Record<string, string> = {
  ad_campaign_daily_metrics: "Campanha",
  sales_orders: "Pedido",
  sales_order_adjustments: "Ajuste de pedido",
  affiliate_conversions: "Conversão de afiliado",
};
