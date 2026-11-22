/**
 * Operações do documento de cena: o único jeito de mudá-lo.
 *
 * O editor e o agente de IA emitem operações; cada uma produz um documento novo
 * (o anterior não é alterado), revalidado inteiro por parseSceneDocument. Isso dá
 * desfazer/refazer (history.ts), um diff revisável para a IA e as travas:
 *   - camada `locked: "brand"`: só com `allowBrand` (owner/admin);
 *   - camada `locked: "position"`: texto e cores editáveis, posição e tamanho fixos.
 */
import { ValidationError } from "../http/errors.ts";
import { parseSceneDocument, parseSceneLayer } from "./schema.ts";
import type { LayerLock, SceneDocument, SceneLayer, ScenePage } from "./types.ts";

/** Campos que uma atualização pode trocar (id e type nunca mudam). */
export type LayerPatch = { [key: string]: unknown };

export type SceneOperation =
  | { op: "layer.update"; pageId: string; layerId: string; patch: LayerPatch }
  | { op: "layer.add"; pageId: string; layer: SceneLayer; index?: number }
  | { op: "layer.remove"; pageId: string; layerId: string }
  | { op: "layer.move"; pageId: string; layerId: string; toIndex: number }
  | { op: "layer.lock"; pageId: string; layerId: string; locked: LayerLock | null }
  | { op: "page.add"; page: ScenePage; index?: number }
  | { op: "page.remove"; pageId: string }
  | { op: "page.move"; pageId: string; toIndex: number };

export type OperationOptions = {
  /** Permite mexer em camadas travadas como marca (owner/admin). */
  allowBrand?: boolean;
};

export class SceneOperationError extends ValidationError {
  constructor(message: string) {
    super(message);
    this.name = "SceneOperationError";
  }
}

const GEOMETRY_KEYS = new Set(["x", "y", "rotation", "width", "height", "scale"]);
const IMMUTABLE_KEYS = new Set(["id", "type", "locked"]);

function clone<T>(value: T): T {
  return structuredClone(value);
}

function findPage(doc: SceneDocument, pageId: string): ScenePage {
  const page = doc.pages.find((item) => item.id === pageId);
  if (!page) throw new SceneOperationError(`Página "${pageId}" não existe.`);
  return page;
}

function findLayerIndex(page: ScenePage, layerId: string): number {
  const index = page.layers.findIndex((item) => item.id === layerId);
  if (index < 0) throw new SceneOperationError(`Camada "${layerId}" não existe.`);
  return index;
}

function assertEditable(layer: SceneLayer, options: OperationOptions, action: string): void {
  if (layer.locked === "brand" && !options.allowBrand) {
    throw new SceneOperationError(`A camada "${layer.name ?? layer.id}" é da marca e está travada: ${action} exige owner ou admin.`);
  }
}

function clampIndex(index: number | undefined, length: number): number {
  if (index === undefined) return length;
  if (!Number.isInteger(index)) throw new SceneOperationError("Posição inválida.");
  return Math.max(0, Math.min(length, index));
}

function moveItem<T>(items: T[], from: number, to: number): void {
  const [item] = items.splice(from, 1);
  items.splice(Math.max(0, Math.min(items.length, to)), 0, item);
}

/** Aplica uma operação e devolve o documento novo, já validado. */
export function applyOperation(doc: SceneDocument, operation: SceneOperation, options: OperationOptions = {}): SceneDocument {
  const next = clone(doc);

  switch (operation.op) {
    case "layer.update": {
      const page = findPage(next, operation.pageId);
      const index = findLayerIndex(page, operation.layerId);
      const current = page.layers[index];
      assertEditable(current, options, "editar");
      const patch = operation.patch ?? {};
      for (const key of Object.keys(patch)) {
        if (IMMUTABLE_KEYS.has(key)) throw new SceneOperationError(`"${key}" não pode ser alterado por atualização.`);
        if (current.locked === "position" && GEOMETRY_KEYS.has(key) && !options.allowBrand) {
          throw new SceneOperationError(`A camada "${current.name ?? current.id}" tem posição travada.`);
        }
      }
      const merged: Record<string, unknown> = { ...current, ...clone(patch) };
      for (const [key, value] of Object.entries(merged)) if (value === undefined) delete merged[key];
      page.layers[index] = parseSceneLayer(merged, `camada ${current.id}`);
      break;
    }
    case "layer.add": {
      const page = findPage(next, operation.pageId);
      const layer = parseSceneLayer(clone(operation.layer), "nova camada");
      if (layer.locked === "brand" && !options.allowBrand) {
        throw new SceneOperationError("Só owner ou admin adiciona camadas travadas como marca.");
      }
      page.layers.splice(clampIndex(operation.index, page.layers.length), 0, layer);
      break;
    }
    case "layer.remove": {
      const page = findPage(next, operation.pageId);
      const index = findLayerIndex(page, operation.layerId);
      assertEditable(page.layers[index], options, "remover");
      page.layers.splice(index, 1);
      break;
    }
    case "layer.move": {
      const page = findPage(next, operation.pageId);
      const index = findLayerIndex(page, operation.layerId);
      assertEditable(page.layers[index], options, "reordenar");
      moveItem(page.layers, index, clampIndex(operation.toIndex, page.layers.length - 1));
      break;
    }
    case "layer.lock": {
      const page = findPage(next, operation.pageId);
      const index = findLayerIndex(page, operation.layerId);
      const layer = page.layers[index];
      if ((layer.locked === "brand" || operation.locked === "brand") && !options.allowBrand) {
        throw new SceneOperationError("Só owner ou admin trava ou destrava camadas da marca.");
      }
      if (operation.locked === null) delete layer.locked;
      else layer.locked = operation.locked;
      break;
    }
    case "page.add": {
      next.pages.splice(clampIndex(operation.index, next.pages.length), 0, clone(operation.page));
      break;
    }
    case "page.remove": {
      const index = next.pages.findIndex((item) => item.id === operation.pageId);
      if (index < 0) throw new SceneOperationError(`Página "${operation.pageId}" não existe.`);
      if (!options.allowBrand && next.pages[index].layers.some((layer) => layer.locked === "brand")) {
        throw new SceneOperationError("A página tem camadas da marca: remover exige owner ou admin.");
      }
      next.pages.splice(index, 1);
      break;
    }
    case "page.move": {
      const index = next.pages.findIndex((item) => item.id === operation.pageId);
      if (index < 0) throw new SceneOperationError(`Página "${operation.pageId}" não existe.`);
      moveItem(next.pages, index, clampIndex(operation.toIndex, next.pages.length - 1));
      break;
    }
    default:
      throw new SceneOperationError("Operação desconhecida.");
  }

  // Editado à mão: as camadas passam a ser a verdade, não os parâmetros do template.
  if (next.template) next.template.detached = true;
  return parseSceneDocument(next);
}

/** Aplica várias operações em ordem; se uma falhar, nada é aplicado. */
export function applyOperations(doc: SceneDocument, operations: readonly SceneOperation[], options: OperationOptions = {}): SceneDocument {
  return operations.reduce((current, operation) => applyOperation(current, operation, options), doc);
}
