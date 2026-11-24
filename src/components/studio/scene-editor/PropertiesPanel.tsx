"use client";

import type { LayerPatch, SceneOperation } from "@/lib/scene/operations";
import type { FontRole, SceneLayer, ScenePage, TextAnchor } from "@/lib/scene/types";
import { LICENSE_STATUS_LABEL, LICENSE_STATUS_TONE, type LicenseStatus } from "@/lib/media/types";
import { ColorField, NumberField, SelectField, TextField } from "./fields";
import { layerLabel } from "./LayersPanel";

const FONT_OPTIONS: readonly { value: FontRole; label: string }[] = [
  { value: "display", label: "Título (Sora)" },
  { value: "badge", label: "Selo (Sora)" },
  { value: "body", label: "Texto (Inter)" },
];

const WEIGHT_OPTIONS: readonly { value: number; label: string }[] = [400, 500, 600, 700, 800, 900].map((value) => ({
  value,
  label: String(value),
}));

const ANCHOR_OPTIONS: readonly { value: TextAnchor; label: string }[] = [
  { value: "start", label: "Início" },
  { value: "middle", label: "Centro" },
  { value: "end", label: "Fim" },
];

/** Peso que a classe da fonte já aplica (svg-typography.ts) quando a camada não define. */
const DEFAULT_WEIGHT: Record<FontRole, number> = { display: 900, badge: 800, body: 400 };

type Props = {
  page: ScenePage;
  layer: SceneLayer | null;
  run: (operation: SceneOperation) => boolean;
  /** Situação da licença das imagens (vem da biblioteca); ausente = desconhecida. */
  licenses: Record<string, LicenseStatus>;
};

export function PropertiesPanel({ page, layer, run, licenses }: Props) {
  if (!layer) {
    return (
      <section className="scene-panel" aria-label="Propriedades">
        <h3 className="scene-panel-title">Propriedades</h3>
        <p className="scene-save-hint">Clique numa camada na tela ou na lista para editar. Clique duas vezes num texto para escrever direto nele.</p>
      </section>
    );
  }

  const update = (patch: LayerPatch) => run({ op: "layer.update", pageId: page.id, layerId: layer.id, patch });
  const brandLocked = layer.locked === "brand";
  const geometryLocked = brandLocked || layer.locked === "position";
  const rectFitted = layer.type === "rect" && layer.fitText;

  return (
    <section className="scene-panel" aria-label="Propriedades">
      <h3 className="scene-panel-title">{layerLabel(layer)}</h3>
      {brandLocked && <p className="scene-save-hint">Camada da marca, travada. Só owner ou admin destrava (lista de camadas).</p>}
      {layer.locked === "position" && <p className="scene-save-hint">Posição e tamanho travados; conteúdo e cores seguem editáveis.</p>}

      <fieldset className="scene-fields" disabled={brandLocked}>
        {layer.type === "text" && (
          <>
            <TextField label="Texto" value={layer.text} maxLength={2000} onCommit={(text) => update({ text })} />
            <SelectField label="Fonte" value={layer.font} options={FONT_OPTIONS} onCommit={(font) => update({ font })} />
            <NumberField label="Tamanho" value={layer.size} min={1} max={512} disabled={geometryLocked} onCommit={(size) => update({ size })} />
            <SelectField label="Peso" value={layer.weight ?? DEFAULT_WEIGHT[layer.font]} options={WEIGHT_OPTIONS} onCommit={(weight) => update({ weight })} />
            <SelectField label="Alinhamento" value={layer.anchor ?? "start"} options={ANCHOR_OPTIONS} onCommit={(anchor) => update({ anchor: anchor === "start" ? undefined : anchor })} />
            <ColorField label="Cor" value={layer.color} onCommit={(color) => update({ color })} />
          </>
        )}

        {layer.type === "rect" && (
          <>
            <ColorField label="Preenchimento" value={layer.fill} onCommit={(fill) => update({ fill })} />
            <ColorField label="Contorno" value={layer.stroke} onCommit={(stroke) => update({ stroke })} />
            {!rectFitted && <NumberField label="Largura" value={layer.width} min={1} max={10000} disabled={geometryLocked} onCommit={(width) => update({ width })} />}
            <NumberField label="Altura" value={layer.height} min={1} max={10000} disabled={geometryLocked} onCommit={(height) => update({ height })} />
            <NumberField label="Cantos" value={layer.radius ?? 0} min={0} max={5000} onCommit={(radius) => update({ radius: radius || undefined })} />
            {rectFitted && <p className="scene-save-hint">A largura acompanha o texto ligado a esta forma.</p>}
          </>
        )}

        {layer.type === "image" && (
          <>
            <NumberField label="Largura" value={layer.width} min={1} max={10000} disabled={geometryLocked} onCommit={(width) => update({ width })} />
            <NumberField label="Altura" value={layer.height} min={1} max={10000} disabled={geometryLocked} onCommit={(height) => update({ height })} />
            <SelectField
              label="Encaixe"
              value={layer.fit ?? "cover"}
              options={[
                { value: "cover", label: "Preencher" },
                { value: "contain", label: "Caber inteira" },
              ]}
              onCommit={(fit) => update({ fit })}
            />
            {licenses[layer.assetId] && (
              <p className={`scene-license scene-license-${LICENSE_STATUS_TONE[licenses[layer.assetId]]}`}>
                {LICENSE_STATUS_LABEL[licenses[layer.assetId]]}
                {licenses[layer.assetId] !== "valid" && " — a fila bloqueia a publicação até haver licença válida."}
              </p>
            )}
          </>
        )}

        {layer.type === "brand" && (
          <NumberField label="Escala" value={layer.scale ?? 1} min={0.01} max={100} step={0.05} disabled={geometryLocked} onCommit={(scale) => update({ scale })} />
        )}

        <NumberField label="X" value={layer.x} min={-10000} max={10000} disabled={geometryLocked} onCommit={(x) => update({ x })} />
        <NumberField label="Y" value={layer.y} min={-10000} max={10000} disabled={geometryLocked} onCommit={(y) => update({ y })} />
        <NumberField label="Rotação" value={layer.rotation ?? 0} min={-360} max={360} disabled={geometryLocked} onCommit={(rotation) => update({ rotation: rotation || undefined })} />
        <NumberField
          label="Opacidade %"
          value={Math.round((layer.opacity ?? 1) * 100)}
          min={0}
          max={100}
          onCommit={(percent) => update({ opacity: percent >= 100 ? undefined : percent / 100 })}
        />
      </fieldset>
    </section>
  );
}
