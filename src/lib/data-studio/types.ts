/**
 * SMKON Data Studio Types & Schemas (Prisma Studio REA)
 * Tipagens completas do motor de dados estilo planilha com buffer de staging e relações.
 */

export type ColumnDataType =
  | "string"
  | "currency"
  | "number"
  | "enum"
  | "boolean"
  | "url"
  | "date"
  | "relation";

export interface ColumnDefinition {
  key: string;
  label: string;
  type: ColumnDataType;
  readOnly?: boolean;
  options?: { value: string; label: string; tone?: "ok" | "warn" | "neutral" | "info" }[];
  relationTargetModel?: string;
  relationLabelField?: string;
}

export interface ModelDefinition {
  id: string;
  name: string;
  label: string;
  icon: string;
  primaryKey: string;
  columns: ColumnDefinition[];
}

export type RecordStatus = "pristine" | "modified" | "created" | "deleted";

export interface StagingChange {
  id: string;
  type: "create" | "update" | "delete";
  modelId: string;
  recordId: string;
  field?: string;
  oldValue?: unknown;
  newValue?: unknown;
  createdAt: number;
}

export interface StagingState {
  changes: StagingChange[];
  createdRecords: Record<string, Record<string, unknown>[]>;
}

export interface FilterCriterion {
  column: string;
  operator: "equals" | "contains" | "gt" | "gte" | "lt" | "lte" | "in";
  value: string | number | boolean;
}

export interface SortCriterion {
  column: string;
  direction: "asc" | "desc";
}

export interface RelationalDrawerContext {
  isOpen: boolean;
  sourceModelId: string;
  sourceRecordId: string;
  targetModelId: string;
  title: string;
  records: Record<string, unknown>[];
}

/**
 * Modelos padrão do ecossistema SMKON inspecionáveis no Data Studio
 */
export const SMKON_MODELS: Record<string, ModelDefinition> = {
  products: {
    id: "products",
    name: "products",
    label: "Produtos & Achados",
    icon: "🛍️",
    primaryKey: "id",
    columns: [
      { key: "id", label: "ID", type: "string", readOnly: true },
      { key: "name", label: "Nome do Produto", type: "string" },
      { key: "price", label: "Preço de Venda", type: "currency" },
      { key: "commissionRate", label: "Comissão (%)", type: "number" },
      {
        key: "category",
        label: "Categoria",
        type: "enum",
        options: [
          { value: "perifericos", label: "Periféricos & Setup", tone: "info" },
          { value: "utilidades", label: "Utilidades & Casa", tone: "neutral" },
          { value: "moda", label: "Moda & Acessórios", tone: "ok" },
          { value: "infoprodutos", label: "Infoprodutos Digitais", tone: "warn" },
        ],
      },
      {
        key: "source",
        label: "Origem / Marketplace",
        type: "enum",
        options: [
          { value: "shopee", label: "Shopee", tone: "warn" },
          { value: "shein", label: "Shein", tone: "ok" },
          { value: "kiwify", label: "Kiwify", tone: "info" },
          { value: "hotmart", label: "Hotmart", tone: "warn" },
          { value: "mercado-livre", label: "Mercado Livre", tone: "warn" },
        ],
      },
      {
        key: "status",
        label: "Status",
        type: "enum",
        options: [
          { value: "active", label: "Ativo", tone: "ok" },
          { value: "review", label: "Em Revisão", tone: "warn" },
          { value: "archived", label: "Arquivado", tone: "neutral" },
        ],
      },
      { key: "score", label: "Score IA", type: "number" },
      {
        key: "contentsCount",
        label: "Conteúdos Vinculados",
        type: "relation",
        readOnly: true,
        relationTargetModel: "content",
      },
    ],
  },

  content: {
    id: "content",
    name: "content",
    label: "Conteúdos do Estúdio",
    icon: "🎬",
    primaryKey: "id",
    columns: [
      { key: "id", label: "ID", type: "string", readOnly: true },
      { key: "title", label: "Título da Peça", type: "string" },
      { key: "productName", label: "Produto Associado", type: "string" },
      { key: "channel", label: "Canal", type: "string" },
      {
        key: "status",
        label: "Status de Aprovação",
        type: "enum",
        options: [
          { value: "Rascunho", label: "Rascunho", tone: "warn" },
          { value: "Aprovado", label: "Aprovado", tone: "ok" },
          { value: "Arquivado", label: "Arquivado", tone: "neutral" },
        ],
      },
      { key: "promoCode", label: "Cupom Ativo", type: "string" },
      { key: "viewsEstimated", label: "Visualizações Estimadas", type: "number" },
    ],
  },

  transactions: {
    id: "transactions",
    name: "transactions",
    label: "Comissões & Vendas",
    icon: "💰",
    primaryKey: "id",
    columns: [
      { key: "id", label: "ID Transação", type: "string", readOnly: true },
      { key: "orderId", label: "Pedido Externo", type: "string", readOnly: true },
      {
        key: "platform",
        label: "Marketplace",
        type: "enum",
        options: [
          { value: "shopee", label: "Shopee Afiliados", tone: "warn" },
          { value: "shein", label: "Shein VIP", tone: "ok" },
          { value: "kiwify", label: "Kiwify Digital", tone: "info" },
          { value: "hotmart", label: "Hotmart", tone: "warn" },
        ],
      },
      { key: "grossAmount", label: "Valor Total", type: "currency" },
      { key: "commissionAmount", label: "Comissão Líquida", type: "currency" },
      {
        key: "status",
        label: "Status Pagamento",
        type: "enum",
        options: [
          { value: "approved", label: "Aprovado", tone: "ok" },
          { value: "pending", label: "Pendente", tone: "warn" },
          { value: "refunded", label: "Estornado", tone: "neutral" },
        ],
      },
      { key: "date", label: "Data", type: "date" },
    ],
  },
};
