"use client";

import { BRAND_ELEMENTS } from "@/lib/scene/elements";
import type { OperationOptions, SceneOperation } from "@/lib/scene/operations";
import type { SceneLayer, ScenePage } from "@/lib/scene/types";

const TYPE_LABEL: Record<SceneLayer["type"], string> = {
  text: "Texto",
  rect: "Forma",
  image: "Imagem",
  brand: "Marca",
};

export function layerLabel(layer: SceneLayer): string {
  if (layer.name) return layer.name;
  if (layer.type === "brand") return BRAND_ELEMENTS[layer.element]?.label ?? layer.element;
  if (layer.type === "text") return layer.text.slice(0, 32) || TYPE_LABEL.text;
  return TYPE_LABEL[layer.type];
}

type Props = {
  page: ScenePage;
  selectedId: string | null;
  onSelect: (id: string) => void;
  run: (operation: SceneOperation, options?: OperationOptions) => boolean;
  canBrand: boolean;
};

/** Lista de camadas, de cima (frente) para baixo (fundo), como no Photoshop/Canva. */
export function LayersPanel({ page, selectedId, onSelect, run, canBrand }: Props) {
  const rows = page.layers.map((layer, index) => ({ layer, index })).reverse();
  const last = page.layers.length - 1;

  return (
    <section className="scene-panel" aria-label="Camadas">
      <h3 className="scene-panel-title">Camadas</h3>
      <ul className="scene-layers">
        {rows.map(({ layer, index }) => {
          const brand = layer.locked === "brand";
          const editable = !brand;
          const label = layerLabel(layer);
          return (
            <li key={layer.id} className={layer.id === selectedId ? "scene-layer selected" : "scene-layer"} data-hidden={layer.hidden ? "" : undefined}>
              <button
                type="button"
                className="scene-layer-name"
                aria-label={`Selecionar ${label}${brand ? " (marca, travada)" : layer.locked === "position" ? " (posição travada)" : ""}`}
                aria-pressed={layer.id === selectedId}
                onClick={() => onSelect(layer.id)}
              >
                <span className="scene-layer-type">{TYPE_LABEL[layer.type]}</span>
                <span className="scene-layer-label">{label}</span>
                {brand && <span className="scene-lock scene-lock-brand">Marca</span>}
                {layer.locked === "position" && <span className="scene-lock">Posição</span>}
                {layer.type === "text" && layer.bind && <span className="scene-lock scene-lock-data">Produto</span>}
              </button>
              <div className="scene-layer-actions">
                <button
                  type="button"
                  aria-label={layer.hidden ? `Mostrar ${label}` : `Ocultar ${label}`}
                  title={layer.hidden ? "Mostrar" : "Ocultar"}
                  disabled={!editable}
                  onClick={() => run({ op: "layer.update", pageId: page.id, layerId: layer.id, patch: { hidden: layer.hidden ? undefined : true } })}
                >
                  {layer.hidden ? "◌" : "●"}
                </button>
                <button
                  type="button"
                  aria-label={`Trazer ${label} para frente`}
                  title="Para frente"
                  disabled={!editable || index === last}
                  onClick={() => run({ op: "layer.move", pageId: page.id, layerId: layer.id, toIndex: index + 1 })}
                >
                  ↑
                </button>
                <button
                  type="button"
                  aria-label={`Levar ${label} para trás`}
                  title="Para trás"
                  disabled={!editable || index === 0}
                  onClick={() => run({ op: "layer.move", pageId: page.id, layerId: layer.id, toIndex: index - 1 })}
                >
                  ↓
                </button>
                {layer.locked ? (
                  <button
                    type="button"
                    aria-label={`Destravar ${label}`}
                    title={canBrand ? "Destravar" : "Só owner ou admin destrava"}
                    disabled={!canBrand}
                    onClick={() => run({ op: "layer.lock", pageId: page.id, layerId: layer.id, locked: null }, { allowBrand: true })}
                  >
                    🔓
                  </button>
                ) : (
                  <button
                    type="button"
                    aria-label={`Travar posição de ${label}`}
                    title="Travar posição"
                    onClick={() => run({ op: "layer.lock", pageId: page.id, layerId: layer.id, locked: "position" })}
                  >
                    🔒
                  </button>
                )}
                <button
                  type="button"
                  aria-label={`Excluir ${label}`}
                  title="Excluir"
                  disabled={!editable}
                  onClick={() => run({ op: "layer.remove", pageId: page.id, layerId: layer.id })}
                >
                  ✕
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
