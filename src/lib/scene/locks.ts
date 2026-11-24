/**
 * Travas do documento de cena conferidas no servidor.
 *
 * As operações (operations.ts) já respeitam as travas no editor, mas a API recebe o
 * documento inteiro: aqui comparamos a versão gravada com a nova. Sem permissão de
 * marca, nenhuma camada `locked: "brand"` pode mudar, sumir, trocar de página ou ser
 * criada, e camadas `locked: "position"` mantêm posição e tamanho.
 */
import type { MemberRole } from "../tenancy/members.ts";
import { SceneOperationError } from "./operations.ts";
import type { SceneDocument, SceneLayer } from "./types.ts";

/** Quem pode mexer em camadas travadas como marca (e destravá-las). */
export function canEditBrand(role: MemberRole | string | null | undefined): boolean {
  return role === "owner" || role === "admin";
}

const GEOMETRY_KEYS = ["x", "y", "rotation", "width", "height", "scale"] as const;

/** JSON estável (chaves ordenadas) para comparar camadas sem depender da ordem das chaves. */
function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value as Record<string, unknown>)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stable((value as Record<string, unknown>)[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

type Located = { pageId: string; layer: SceneLayer };

function index(doc: SceneDocument | null): Map<string, Located> {
  const map = new Map<string, Located>();
  for (const page of doc?.pages ?? []) {
    for (const layer of page.layers) map.set(`${page.id}/${layer.id}`, { pageId: page.id, layer });
  }
  return map;
}

/**
 * Lança SceneOperationError (400) se `next` mexe em travas que o papel não pode mexer.
 * `previous` null = peça sem design ainda: sem permissão de marca, o design não pode
 * nascer com camadas de marca (quem aplica templates oficiais é owner/admin).
 */
export function assertLocksRespected(
  previous: SceneDocument | null,
  next: SceneDocument | null,
  options: { allowBrand: boolean },
): void {
  if (options.allowBrand) return;
  const before = index(previous);
  const after = index(next);

  for (const [key, { layer }] of before) {
    const current = after.get(key);
    if (layer.locked === "brand") {
      if (!current || stable(current.layer) !== stable(layer)) {
        throw new SceneOperationError(`A camada "${layer.name ?? layer.id}" é da marca: só owner ou admin altera ou remove.`);
      }
    } else if (layer.locked === "position" && current) {
      for (const field of GEOMETRY_KEYS) {
        const a = (layer as Record<string, unknown>)[field];
        const b = (current.layer as Record<string, unknown>)[field];
        if (a !== b) throw new SceneOperationError(`A camada "${layer.name ?? layer.id}" tem posição travada.`);
      }
      if (current.layer.locked !== "position") {
        throw new SceneOperationError(`A trava da camada "${layer.name ?? layer.id}" só pode ser removida por owner ou admin.`);
      }
    }
  }

  for (const [key, { layer }] of after) {
    if (layer.locked === "brand" && !before.has(key)) {
      throw new SceneOperationError(`Só owner ou admin adiciona camadas da marca ("${layer.name ?? layer.id}").`);
    }
  }
}
