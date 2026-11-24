"use client";

import { renderPageSvg } from "@/lib/scene/render";
import type { SceneDocument } from "@/lib/scene/types";

export type ExportType = "png" | "jpeg";

/** URLs assinadas (10 min) das mídias do design; o servidor só assina mídia ativa do workspace. */
export async function fetchSignedUrls(ids: string[]): Promise<Record<string, string>> {
  if (ids.length === 0) return {};
  const res = await fetch("/api/media/signed-urls", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || "Não foi possível carregar as imagens do design.");
  return (body.urls ?? {}) as Record<string, string>;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Não foi possível ler a imagem."));
    reader.readAsDataURL(blob);
  });
}

/**
 * Página do design em PNG/JPG, no tamanho do documento.
 * Um SVG desenhado no canvas não carrega URLs externas: as imagens entram como data URL
 * (assinadas na hora, para não usar link vencido). Sem isso a imagem sairia em branco.
 */
export async function exportScenePage(doc: SceneDocument, pageIndex: number, type: ExportType): Promise<Blob> {
  const page = doc.pages[pageIndex];
  const ids = [...new Set(page.layers.filter((layer) => layer.type === "image" && !layer.hidden).map((layer) => (layer as { assetId: string }).assetId))];
  const urls = await fetchSignedUrls(ids);
  const inlined: Record<string, string> = {};
  for (const id of ids) {
    if (!urls[id]) throw new Error("Uma imagem do design não está mais disponível na biblioteca.");
    const res = await fetch(urls[id]);
    if (!res.ok) throw new Error("Não foi possível baixar uma imagem do design.");
    inlined[id] = await blobToDataUrl(await res.blob());
  }

  const svg = renderPageSvg(doc, { pageIndex, idPrefix: "exp", resolveAsset: (id) => inlined[id] });
  const objectUrl = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
  try {
    const image = new Image();
    image.src = objectUrl;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = doc.width;
    canvas.height = doc.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("O navegador não permitiu desenhar a imagem.");
    if (type === "jpeg") {
      // JPG não tem transparência: fundo escuro da marca em vez de preto do canvas vazio.
      ctx.fillStyle = "#080D12";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    ctx.drawImage(image, 0, 0, doc.width, doc.height);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Falha ao gerar o arquivo."))), `image/${type}`, 0.92),
    );
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
