/**
 * SMKON Staging Engine (Prisma Studio REA)
 * Gerencia o buffer de alterações em memória com diffing atômico, undo e preview.
 */

import type {
  FilterCriterion,
  RecordStatus,
  SortCriterion,
  StagingChange,
  StagingState,
} from "./types.ts";

export function createInitialStagingState(): StagingState {
  return {
    changes: [],
    createdRecords: {},
  };
}

/**
 * Registra ou atualiza a edição de um campo no buffer de staging
 */
export function applyFieldEdit(
  state: StagingState,
  modelId: string,
  recordId: string,
  field: string,
  oldValue: unknown,
  newValue: unknown
): StagingState {
  // Se o novo valor for idêntico ao valor original, remove qualquer alteração pendente para esse campo
  if (oldValue === newValue) {
    const filteredChanges = state.changes.filter(
      (c) => !(c.modelId === modelId && c.recordId === recordId && c.field === field)
    );
    return { ...state, changes: filteredChanges };
  }

  // Verifica se já existia uma alteração pendente para este campo
  const existingIndex = state.changes.findIndex(
    (c) => c.modelId === modelId && c.recordId === recordId && c.field === field
  );

  const updatedChanges = [...state.changes];
  const newChange: StagingChange = {
    id: `chg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type: "update",
    modelId,
    recordId,
    field,
    oldValue: existingIndex >= 0 ? updatedChanges[existingIndex].oldValue : oldValue,
    newValue,
    createdAt: Date.now(),
  };

  if (existingIndex >= 0) {
    updatedChanges[existingIndex] = newChange;
  } else {
    updatedChanges.push(newChange);
  }

  return {
    ...state,
    changes: updatedChanges,
  };
}

/**
 * Adiciona um novo registro ao buffer de staging
 */
export function applyAddRecord(
  state: StagingState,
  modelId: string,
  recordData: Record<string, unknown>
): StagingState {
  const recordId = String(recordData.id || `new-${Date.now()}`);
  const recordWithId = { ...recordData, id: recordId };

  const currentCreated = state.createdRecords[modelId] || [];
  const updatedCreated = [...currentCreated, recordWithId];

  const change: StagingChange = {
    id: `create-${recordId}`,
    type: "create",
    modelId,
    recordId,
    newValue: recordWithId,
    createdAt: Date.now(),
  };

  return {
    ...state,
    changes: [...state.changes, change],
    createdRecords: {
      ...state.createdRecords,
      [modelId]: updatedCreated,
    },
  };
}

/**
 * Marca um registro existente para exclusão no buffer de staging
 */
export function applyDeleteRecord(
  state: StagingState,
  modelId: string,
  recordId: string
): StagingState {
  // Se foi criado no staging e ainda não foi comitado, apenas remove da lista de criados
  const isCreated = (state.createdRecords[modelId] || []).some((r) => r.id === recordId);
  if (isCreated) {
    return {
      ...state,
      changes: state.changes.filter(
        (c) => !(c.modelId === modelId && c.recordId === recordId)
      ),
      createdRecords: {
        ...state.createdRecords,
        [modelId]: (state.createdRecords[modelId] || []).filter((r) => r.id !== recordId),
      },
    };
  }

  // Se já estava marcado para deleção, desfaz a marcação (toggle)
  const existingDeleteIndex = state.changes.findIndex(
    (c) => c.modelId === modelId && c.recordId === recordId && c.type === "delete"
  );

  if (existingDeleteIndex >= 0) {
    return {
      ...state,
      changes: state.changes.filter((_, idx) => idx !== existingDeleteIndex),
    };
  }

  const change: StagingChange = {
    id: `del-${recordId}`,
    type: "delete",
    modelId,
    recordId,
    createdAt: Date.now(),
  };

  return {
    ...state,
    changes: [...state.changes, change],
  };
}

/**
 * Descarta uma alteração específica pelo ID
 */
export function discardChange(state: StagingState, changeId: string): StagingState {
  const target = state.changes.find((c) => c.id === changeId);
  if (!target) return state;

  if (target.type === "create") {
    return {
      ...state,
      changes: state.changes.filter((c) => c.id !== changeId),
      createdRecords: {
        ...state.createdRecords,
        [target.modelId]: (state.createdRecords[target.modelId] || []).filter(
          (r) => r.id !== target.recordId
        ),
      },
    };
  }

  return {
    ...state,
    changes: state.changes.filter((c) => c.id !== changeId),
  };
}

/**
 * Descarta todas as alterações pendentes no staging
 */
export function discardAll(): StagingState {
  return createInitialStagingState();
}

/**
 * Retorna o status visual do registro no staging (pristine, modified, created, deleted)
 */
export function getRecordStatus(
  state: StagingState,
  modelId: string,
  recordId: string
): RecordStatus {
  const isDeleted = state.changes.some(
    (c) => c.modelId === modelId && c.recordId === recordId && c.type === "delete"
  );
  if (isDeleted) return "deleted";

  const isCreated = (state.createdRecords[modelId] || []).some((r) => r.id === recordId);
  if (isCreated) return "created";

  const hasModifications = state.changes.some(
    (c) => c.modelId === modelId && c.recordId === recordId && c.type === "update"
  );
  if (hasModifications) return "modified";

  return "pristine";
}

/**
 * Aplica todas as modificações pendentes no registro para exibição imediata
 */
export function getRecordMergedValue(
  state: StagingState,
  modelId: string,
  originalRecord: Record<string, unknown>
): Record<string, unknown> {
  const relevantChanges = state.changes.filter(
    (c) => c.modelId === modelId && c.recordId === originalRecord.id && c.type === "update" && c.field
  );

  if (relevantChanges.length === 0) return originalRecord;

  const merged = { ...originalRecord };
  for (const chg of relevantChanges) {
    if (chg.field) {
      merged[chg.field] = chg.newValue;
    }
  }
  return merged;
}

/**
 * Calcula sumário das alterações pendentes
 */
export function computeStagingSummary(state: StagingState): {
  totalChanges: number;
  editsCount: number;
  createsCount: number;
  deletesCount: number;
} {
  let editsCount = 0;
  let createsCount = 0;
  let deletesCount = 0;

  for (const chg of state.changes) {
    if (chg.type === "update") editsCount++;
    else if (chg.type === "create") createsCount++;
    else if (chg.type === "delete") deletesCount++;
  }

  return {
    totalChanges: state.changes.length,
    editsCount,
    createsCount,
    deletesCount,
  };
}

/**
 * Prepara o payload de commit atômico para persistência
 */
export function buildCommitPayload(state: StagingState): {
  toCreate: { modelId: string; record: Record<string, unknown> }[];
  toUpdate: { modelId: string; recordId: string; updates: Record<string, unknown> }[];
  toDelete: { modelId: string; recordId: string }[];
} {
  const toCreate: { modelId: string; record: Record<string, unknown> }[] = [];
  const toDelete: { modelId: string; recordId: string }[] = [];
  const updatesMap = new Map<string, { modelId: string; recordId: string; updates: Record<string, unknown> }>();

  for (const chg of state.changes) {
    if (chg.type === "create") {
      toCreate.push({
        modelId: chg.modelId,
        record: chg.newValue as Record<string, unknown>,
      });
    } else if (chg.type === "delete") {
      toDelete.push({
        modelId: chg.modelId,
        recordId: chg.recordId,
      });
    } else if (chg.type === "update" && chg.field) {
      const key = `${chg.modelId}:${chg.recordId}`;
      if (!updatesMap.has(key)) {
        updatesMap.set(key, {
          modelId: chg.modelId,
          recordId: chg.recordId,
          updates: {},
        });
      }
      const item = updatesMap.get(key)!;
      item.updates[chg.field] = chg.newValue;
    }
  }

  return {
    toCreate,
    toUpdate: Array.from(updatesMap.values()),
    toDelete,
  };
}

/**
 * Filtra e ordena registros em memória de acordo com os critérios informados
 */
export function filterAndSortRecords(
  records: Record<string, unknown>[],
  filters: FilterCriterion[],
  sort?: SortCriterion,
  searchQuery?: string
): Record<string, unknown>[] {
  let result = [...records];

  // 1. Busca textual global
  if (searchQuery && searchQuery.trim().length > 0) {
    const q = searchQuery.toLowerCase().trim();
    result = result.filter((row) =>
      Object.values(row).some((val) => String(val ?? "").toLowerCase().includes(q))
    );
  }

  // 2. Filtros por coluna
  for (const f of filters) {
    result = result.filter((row) => {
      const rawVal = row[f.column];
      if (rawVal === undefined || rawVal === null) return false;

      switch (f.operator) {
        case "equals":
          return String(rawVal).toLowerCase() === String(f.value).toLowerCase();
        case "contains":
          return String(rawVal).toLowerCase().includes(String(f.value).toLowerCase());
        case "gt":
          return Number(rawVal) > Number(f.value);
        case "gte":
          return Number(rawVal) >= Number(f.value);
        case "lt":
          return Number(rawVal) < Number(f.value);
        case "lte":
          return Number(rawVal) <= Number(f.value);
        case "in":
          return String(f.value).split(",").map((s) => s.trim().toLowerCase()).includes(String(rawVal).toLowerCase());
        default:
          return true;
      }
    });
  }

  // 3. Ordenação
  if (sort) {
    result.sort((a, b) => {
      const valA = a[sort.column];
      const valB = b[sort.column];

      if (valA === valB) return 0;
      if (valA === undefined || valA === null) return 1;
      if (valB === undefined || valB === null) return -1;

      const compare = typeof valA === "number" && typeof valB === "number"
        ? valA - valB
        : String(valA).localeCompare(String(valB));

      return sort.direction === "asc" ? compare : -compare;
    });
  }

  return result;
}
