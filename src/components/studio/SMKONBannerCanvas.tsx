"use client";

import { useMemo, useState, useRef } from "react";
import {
  type SmartBannerConfig,
  generateSmartBannerSvg,
  getBannerDimensions,
} from "@/lib/media/smart-banner-engine";

interface SMKONBannerCanvasProps {
  config: SmartBannerConfig;
}

export function SMKONBannerCanvas({ config }: SMKONBannerCanvasProps) {
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const svgContent = useMemo(() => {
    return generateSmartBannerSvg(config);
  }, [config]);

  const { width, height } = useMemo(() => {
    return getBannerDimensions(config.aspectRatio);
  }, [config.aspectRatio]);

  // Copiar código SVG vetorial para área de transferência
  const handleCopySvg = async () => {
    try {
      await navigator.clipboard.writeText(svgContent.trim());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback simples
      const textArea = document.createElement("textarea");
      textArea.value = svgContent.trim();
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Exportar PNG em Alta Resolução (Retina 2x) via HTML5 Canvas
  const handleDownloadPng = async () => {
    setDownloading(true);
    try {
      const scale = 2; // Retina 2x
      const canvas = document.createElement("canvas");
      canvas.width = width * scale;
      canvas.height = height * scale;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const img = new Image();
      const svgBlob = new Blob([svgContent], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(svgBlob);

      img.onload = () => {
        ctx.scale(scale, scale);
        ctx.drawImage(img, 0, 0);
        URL.revokeObjectURL(url);

        const pngUrl = canvas.toDataURL("image/png");
        const link = document.createElement("a");
        link.download = `smkon-banner-${config.archetype}-${config.aspectRatio.replace(":", "x")}.png`;
        link.href = pngUrl;
        link.click();
        setDownloading(false);
      };

      img.onerror = () => {
        URL.revokeObjectURL(url);
        setDownloading(false);
      };

      img.src = url;
    } catch {
      setDownloading(false);
    }
  };

  // Calcular estilo de proporção do container de preview
  const aspectRatioStyle = useMemo(() => {
    if (config.aspectRatio === "9:16") {
      return { maxWidth: "340px", aspectRatio: "9/16" };
    }
    if (config.aspectRatio === "1:1") {
      return { maxWidth: "460px", aspectRatio: "1/1" };
    }
    return { maxWidth: "100%", aspectRatio: "16/9" };
  }, [config.aspectRatio]);

  return (
    <div className="smkon-banner-canvas-wrap">
      <div className="banner-canvas-header">
        <div className="canvas-meta">
          <span className="brand-dot" />
          <span className="canvas-title">Capa Padronizada SMKON · {config.aspectRatio}</span>
          <span className="canvas-dims">
            {width} × {height}px
          </span>
        </div>
        <div className="canvas-actions">
          <button
            type="button"
            className="btn-canvas-action"
            onClick={handleCopySvg}
            title="Copiar código SVG para o Figma ou Illustrator"
          >
            {copied ? "✓ SVG Copiado!" : "📋 Copiar SVG"}
          </button>
          <button
            type="button"
            className="btn-canvas-action primary"
            onClick={handleDownloadPng}
            disabled={downloading}
            title="Baixar em PNG 2x Retina para publicação"
          >
            {downloading ? "Renderizando..." : "📥 Baixar PNG (Retina 2x)"}
          </button>
        </div>
      </div>

      <div className="banner-canvas-stage">
        <div
          ref={containerRef}
          className="banner-canvas-frame"
          style={aspectRatioStyle}
          dangerouslySetInnerHTML={{ __html: svgContent }}
        />
      </div>

      <div className="banner-canvas-footer-hints">
        <small>
          💡 <strong>Regras do Design System SMKON aplicadas:</strong> Fundo cósmico #080D12, logo
          oficial com estrela cósmica, tipografia Sora (Títulos) e Inter (Subtítulos), Mascote SMK
          3D com fone LED e HUD holográfico.
        </small>
      </div>
    </div>
  );
}
