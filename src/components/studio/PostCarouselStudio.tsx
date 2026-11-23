"use client";

import { useMemo, useState } from "react";
import {
  type SmartPostPackage,
  type PostSlide,
  OFFICIAL_POST_PRESETS,
  generateAutonomousPost,
  generatePostSlideSvg,
} from "@/lib/content/smart-post-generator";
import { MASCOT_EXPRESSIONS, type MascotExpression } from "@/lib/media/brand-system";
import { postPackageToScene } from "@/lib/scene/templates/smkon-post";
import { SceneSaveControl, type SavedScene, type ScenePiece } from "./SceneSaveControl";

interface PostCarouselStudioProps {
  draftTitle?: string;
  draftProduct?: string;
  onApplyPostToDraft?: (post: SmartPostPackage) => void;
  /** Post salvo na peça aberta (documento de cena), para reabrir no formulário. */
  initialPost?: SmartPostPackage | null;
  /** Peça aberta no Studio, onde o carrossel é salvo. */
  piece?: ScenePiece | null;
  onSceneSaved?: (saved: SavedScene) => void;
}

export function PostCarouselStudio({
  draftTitle,
  draftProduct,
  onApplyPostToDraft,
  initialPost,
  piece = null,
  onSceneSaved,
}: PostCarouselStudioProps) {
  const [activePost, setActivePost] = useState<SmartPostPackage>(() =>
    initialPost ?? OFFICIAL_POST_PRESETS["carrossel-5-achados"]
  );
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [copiedCaption, setCopiedCaption] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const activeSlide: PostSlide = useMemo(() => {
    return activePost.slides[currentSlideIndex] || activePost.slides[0];
  }, [activePost.slides, currentSlideIndex]);

  const slideSvg = useMemo(() => {
    return generatePostSlideSvg(activeSlide, activePost.aspectRatio);
  }, [activeSlide, activePost.aspectRatio]);

  // Navegação entre slides
  const handlePrevSlide = () => {
    setCurrentSlideIndex((prev) => (prev > 0 ? prev - 1 : activePost.slides.length - 1));
  };

  const handleNextSlide = () => {
    setCurrentSlideIndex((prev) => (prev < activePost.slides.length - 1 ? prev + 1 : 0));
  };

  // Copiar legenda completa formatada
  const handleCopyCaption = async () => {
    const fullText = `${activePost.caption}\n\n${activePost.hashtags}`;
    try {
      await navigator.clipboard.writeText(fullText.trim());
      setCopiedCaption(true);
      setTimeout(() => setCopiedCaption(false), 2000);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = fullText.trim();
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopiedCaption(true);
      setTimeout(() => setCopiedCaption(false), 2000);
    }
  };

  // Exportar Slide Atual em PNG Retina 2x via Canvas
  const handleDownloadSlidePng = () => {
    setDownloading(true);
    try {
      const scale = 2; // Retina 2x (2160x2160)
      const width = 1080;
      const height = activePost.aspectRatio === "4:5" ? 1350 : 1080;
      const canvas = document.createElement("canvas");
      canvas.width = width * scale;
      canvas.height = height * scale;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const img = new Image();
      const svgBlob = new Blob([slideSvg], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(svgBlob);

      img.onload = () => {
        ctx.scale(scale, scale);
        ctx.drawImage(img, 0, 0);
        URL.revokeObjectURL(url);

        const pngUrl = canvas.toDataURL("image/png");
        const link = document.createElement("a");
        link.download = `smkon-slide-${activeSlide.slideNumber}-de-${activeSlide.totalSlides}.png`;
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

  // Carregar preset oficial
  const handleSelectPreset = (key: string) => {
    const preset = OFFICIAL_POST_PRESETS[key];
    if (preset) {
      setActivePost({ ...preset });
      setCurrentSlideIndex(0);
      onApplyPostToDraft?.(preset);
    }
  };

  // Gerar novo post/carrossel automaticamente por IA com base no produto do estúdio
  const handleGenerateAiPost = (kind: SmartPostPackage["kind"]) => {
    const topic = (draftProduct ?? "").trim() || (draftTitle ?? "").trim() || "[tema do post]";
    const generated = generateAutonomousPost(kind, topic);
    setActivePost(generated);
    setCurrentSlideIndex(0);
    onApplyPostToDraft?.(generated);
  };

  // Edição manual do slide ativo
  const handleUpdateActiveSlide = (field: keyof PostSlide, value: unknown) => {
    const updatedSlides = [...activePost.slides];
    updatedSlides[currentSlideIndex] = {
      ...updatedSlides[currentSlideIndex],
      [field]: value,
    };
    setActivePost({ ...activePost, slides: updatedSlides });
  };

  return (
    <div className="post-carousel-studio-grid">
      {/* Coluna 1: Preview do Post / Carrossel */}
      <div className="post-preview-pane">
        <div className="post-preview-top-bar">
          <div className="post-meta-tags">
            <span className="post-kind-badge">
              {activePost.kind === "carousel-tips"
                ? "Carrossel"
                : activePost.kind === "battle-poll"
                ? "Comparativo A vs B"
                : activePost.kind === "question-box"
                ? "Pergunta para a comunidade"
                : "Post de feed"}
            </span>
            <span className="slide-counter-badge">
              Slide {currentSlideIndex + 1} de {activePost.slides.length}
            </span>
          </div>

          <div className="post-action-buttons">
            <button
              type="button"
              className="btn-canvas-action primary"
              onClick={handleDownloadSlidePng}
              disabled={downloading}
              title="Baixar este slide em alta resolução PNG Retina 2x"
            >
              {downloading ? "Exportando..." : "📥 Baixar Slide (PNG 2x)"}
            </button>
          </div>
        </div>

        <SceneSaveControl
          piece={piece}
          what={activePost.slides.length > 1 ? "carrossel" : "arte"}
          buildScene={() => postPackageToScene(activePost)}
          onSaved={(saved) => onSceneSaved?.(saved)}
        />

        {/* Visual Stage */}
        <div className="carousel-stage-frame">
          <div
            className="carousel-svg-render"
            dangerouslySetInnerHTML={{ __html: slideSvg }}
          />

          {/* Botões de navegação lateral para Carrossel */}
          {activePost.slides.length > 1 && (
            <>
              <button
                type="button"
                className="carousel-nav-btn prev"
                onClick={handlePrevSlide}
                title="Slide anterior"
              >
                ‹
              </button>
              <button
                type="button"
                className="carousel-nav-btn next"
                onClick={handleNextSlide}
                title="Próximo slide"
              >
                ›
              </button>
            </>
          )}
        </div>

        {/* Miniaturas dos Slides do Carrossel */}
        {activePost.slides.length > 1 && (
          <div className="carousel-thumbnail-strip">
            {activePost.slides.map((sl, idx) => (
              <button
                key={sl.slideNumber}
                type="button"
                className={`thumb-card ${idx === currentSlideIndex ? "active" : ""}`}
                onClick={() => setCurrentSlideIndex(idx)}
              >
                <span className="thumb-num">{idx + 1}</span>
                <span className="thumb-title">{sl.headline.slice(0, 16)}…</span>
              </button>
            ))}
          </div>
        )}

        {/* Caixa de Legenda & Hashtags formatada */}
        <div className="caption-preview-box">
          <div className="caption-header-row">
            <h4>Legenda &amp; Hashtags Prontas para o Post</h4>
            <button
              type="button"
              className="btn-copy-caption"
              onClick={handleCopyCaption}
            >
              {copiedCaption ? "✓ Legenda Copiada!" : "📋 Copiar Legenda"}
            </button>
          </div>
          <pre className="caption-text-body">{activePost.caption}</pre>
          <div className="hashtags-pill-box">
            <span>{activePost.hashtags}</span>
          </div>
        </div>
      </div>

      {/* Coluna 2: Controles & Automação do Post */}
      <div className="mockup-controls-card">
        <h4 className="controls-title">Motor de Posts &amp; Carrosséis</h4>

        {/* Geração a partir de modelos determinísticos (sem IA). */}
        <div className="field-compact">
          <label>Gerar a partir de um modelo</label>
          <div className="ai-generate-actions">
            <button
              type="button"
              className="btn-ai-post"
              onClick={() => handleGenerateAiPost("carousel-tips")}
            >
              Carrossel de 5 slides
            </button>
            <button
              type="button"
              className="btn-ai-post"
              onClick={() => handleGenerateAiPost("feed-single")}
            >
              Post de feed
            </button>
            <button
              type="button"
              className="btn-ai-post"
              onClick={() => handleGenerateAiPost("battle-poll")}
            >
              Comparativo A vs B
            </button>
          </div>
        </div>

        {/* Presets Rápidos */}
        <div className="field-compact">
          <label>Modelos Prontos das Diretrizes</label>
          <div className="official-presets-pills">
            <button
              type="button"
              className={`preset-pill ${activePost.id === "carrossel-5-achados" ? "active" : ""}`}
              onClick={() => handleSelectPreset("carrossel-5-achados")}
            >
              5 Achados da Shopee
            </button>
            <button
              type="button"
              className={`preset-pill ${activePost.id === "batalha-setup" ? "active" : ""}`}
              onClick={() => handleSelectPreset("batalha-setup")}
            >
              Batalha: Headset vs Earbuds
            </button>
            <button
              type="button"
              className={`preset-pill ${activePost.id === "pergunta-comunidade" ? "active" : ""}`}
              onClick={() => handleSelectPreset("pergunta-comunidade")}
            >
              Pergunta da Comunidade
            </button>
          </div>
        </div>

        {/* Edição do Slide Atual */}
        <div className="field-compact">
          <label>Título do Slide (Sora 900)</label>
          <input
            type="text"
            value={activeSlide.headline}
            onChange={(e) => handleUpdateActiveSlide("headline", e.target.value)}
          />
        </div>

        <div className="field-compact">
          <label>Texto em Destaque (Caixa Colorida)</label>
          <input
            type="text"
            value={activeSlide.highlightText || ""}
            onChange={(e) => handleUpdateActiveSlide("highlightText", e.target.value)}
          />
        </div>

        <div className="field-compact">
          <label>Selo do Slide (Badge)</label>
          <input
            type="text"
            value={activeSlide.badge}
            onChange={(e) => handleUpdateActiveSlide("badge", e.target.value)}
          />
        </div>

        <div className="field-compact">
          <label>Corpo do Texto</label>
          <textarea
            rows={3}
            value={activeSlide.bodyText}
            onChange={(e) => handleUpdateActiveSlide("bodyText", e.target.value)}
          />
        </div>

        <div className="field-compact">
          <label>Expressão do Mascote SMK 3D</label>
          <select
            value={activeSlide.mascotExpression}
            onChange={(e) =>
              handleUpdateActiveSlide("mascotExpression", e.target.value as MascotExpression)
            }
          >
            {Object.entries(MASCOT_EXPRESSIONS).map(([key, exp]) => (
              <option key={key} value={key}>
                {exp.label} · {exp.description}
              </option>
            ))}
          </select>
        </div>

        <div className="field-compact">
          <label>Chamada de Rodapé (CTA)</label>
          <input
            type="text"
            value={activeSlide.callToAction || ""}
            onChange={(e) => handleUpdateActiveSlide("callToAction", e.target.value)}
            placeholder="Ex.: Comente QUERO ou Deslize ➔"
          />
        </div>
      </div>
    </div>
  );
}
