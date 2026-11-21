"use client";

import { useMemo, useState } from "react";
import {
  MOCKUP_THEMES,
  getMockup3DTransforms,
  type MockupColorTheme,
  type MockupKind,
} from "@/lib/media/mockup-generator";
import {
  CONVERSION_BADGE_PRESETS,
  createDefaultBannerConfig,
  type BannerFormat,
  type ConversionBadgeType,
  type PromotionalBannerConfig,
} from "@/lib/media/banner-templates";
import {
  INFOPRODUCT_BLUEPRINTS,
  compileInfoproductToHtml,
  type InfoproductBlueprint,
} from "@/lib/infoproducts";
import { SMKONBannerCanvas } from "./SMKONBannerCanvas";
import {
  OFFICIAL_SMKON_PRESETS,
  inferSmartBannerConfig,
  type SmartBannerConfig,
} from "@/lib/media/smart-banner-engine";
import {
  BANNER_ARCHETYPES,
  MASCOT_EXPRESSIONS,
  type BannerTemplateArchetype,
  type MascotExpression,
} from "@/lib/media/brand-system";

type StudioViewTab = "smkon-brand" | "mockup-3d" | "banner-promo" | "infoproduct-factory";

interface BannerMockupInspectorProps {
  draftTitle?: string;
  draftProduct?: string;
  draftCategory?: string;
}

export function BannerMockupInspector({
  draftTitle,
  draftProduct,
  draftCategory,
}: BannerMockupInspectorProps = {}) {
  const [activeTab, setActiveTab] = useState<StudioViewTab>("smkon-brand");

  // Estado Banner Oficial SMKON (Design System & IA)
  const [smartBannerConfig, setSmartBannerConfig] = useState<SmartBannerConfig>(() =>
    OFFICIAL_SMKON_PRESETS["top-perifericos"]
  );

  // Estado Mockup 3D
  const [mockupKind, setMockupKind] = useState<MockupKind>("ebook-3d");
  const [mockupTheme, setMockupTheme] = useState<MockupColorTheme>("gold-black");
  const [mockupTitle, setMockupTitle] = useState("Manual dos Achadinhos Virais");
  const [mockupSubtitle, setMockupSubtitle] = useState("Do Zero a R$ 5.000/Mês como Afiliado");

  // Estado Banner Promocional (Canva REA)
  const [bannerConfig, setBannerConfig] = useState<PromotionalBannerConfig>(() =>
    createDefaultBannerConfig("Achadinho Shopee Imperdível", "R$ 39,90", "feed-square")
  );

  // Estado Fábrica de Infoprodutos (S25)
  const [selectedBlueprint, setSelectedBlueprint] = useState<InfoproductBlueprint>(
    INFOPRODUCT_BLUEPRINTS[0]
  );
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  const themeStyles = useMemo(() => MOCKUP_THEMES[mockupTheme], [mockupTheme]);
  const transforms3D = useMemo(() => getMockup3DTransforms(mockupKind), [mockupKind]);
  const activeBadge = useMemo(
    () => CONVERSION_BADGE_PRESETS[bannerConfig.badge],
    [bannerConfig.badge]
  );

  const compiledHtml = useMemo(() => {
    return compileInfoproductToHtml(selectedBlueprint);
  }, [selectedBlueprint]);

  const handleDownloadHtml = () => {
    const blob = new Blob([compiledHtml], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${selectedBlueprint.id}.html`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Sincronização inteligente com o roteiro atual do estúdio
  const handleAutoInferFromDraft = () => {
    const inferred = inferSmartBannerConfig({
      title: draftTitle,
      product: draftProduct,
      category: draftCategory,
      format: smartBannerConfig.aspectRatio,
    });
    setSmartBannerConfig(inferred);
  };

  // Carregar preset das diretrizes oficiais
  const handleLoadPreset = (presetKey: string) => {
    const preset = OFFICIAL_SMKON_PRESETS[presetKey];
    if (preset) {
      setSmartBannerConfig({ ...preset });
    }
  };

  // Troca de arquétipo visual
  const handleArchetypeChange = (archetypeKey: BannerTemplateArchetype) => {
    const arch = BANNER_ARCHETYPES[archetypeKey];
    setSmartBannerConfig((prev) => ({
      ...prev,
      archetype: archetypeKey,
      badgeText: arch.badgeText,
      accentColor: arch.accentColor,
      secondaryColor: arch.secondaryColor,
      mascotExpression: arch.recommendedMascot,
    }));
  };

  return (
    <section className="banner-mockup-section">
      <div className="studio-editor-head">
        <div>
          <p className="eyebrow">Diretrizes Oficiais SMKON · Mascote SMK &amp; Design System</p>
          <h2>Criação Padronizada de Banners, Mockups &amp; Capas com IA</h2>
        </div>
        <div className="tab-pill-group">
          <button
            type="button"
            className={activeTab === "smkon-brand" ? "active" : ""}
            onClick={() => setActiveTab("smkon-brand")}
          >
            🎨 Banners SMKON Oficial (IA)
          </button>
          <button
            type="button"
            className={activeTab === "mockup-3d" ? "active" : ""}
            onClick={() => setActiveTab("mockup-3d")}
          >
            Mockup 3D (Photoshop)
          </button>
          <button
            type="button"
            className={activeTab === "banner-promo" ? "active" : ""}
            onClick={() => setActiveTab("banner-promo")}
          >
            Banners &amp; Stories (Canva)
          </button>
          <button
            type="button"
            className={activeTab === "infoproduct-factory" ? "active" : ""}
            onClick={() => setActiveTab("infoproduct-factory")}
          >
            Fábrica de Infoprodutos (S25)
          </button>
        </div>
      </div>

      {/* ABA 1: Banners SMKON Oficial (Diretrizes da Marca, Mascote SMK 3D & IA) */}
      {activeTab === "smkon-brand" && (
        <div className="smkon-brand-studio-grid">
          <div className="smkon-brand-stage-pane">
            <SMKONBannerCanvas config={smartBannerConfig} />
          </div>

          <div className="mockup-controls-card">
            <div className="controls-header-row">
              <h4 className="controls-title">Motor Inteligente SMKON</h4>
              <button
                type="button"
                className="btn-sync-draft"
                onClick={handleAutoInferFromDraft}
                title="Detectar arquétipo, cores e mascote automaticamente a partir do roteiro do estúdio"
              >
                ⚡ IA Auto-Padronizar
              </button>
            </div>

            {/* Presets Oficiais das Diretrizes */}
            <div className="field-compact">
              <label>Presets Oficiais (Diretrizes de Marca)</label>
              <div className="official-presets-pills">
                <button
                  type="button"
                  className={`preset-pill ${smartBannerConfig.id === "top-perifericos" ? "active" : ""}`}
                  onClick={() => handleLoadPreset("top-perifericos")}
                >
                  Top 5 Periféricos
                </button>
                <button
                  type="button"
                  className={`preset-pill ${smartBannerConfig.id === "achado-shopee" ? "active" : ""}`}
                  onClick={() => handleLoadPreset("achado-shopee")}
                >
                  Achado Shopee R$ 79,90
                </button>
                <button
                  type="button"
                  className={`preset-pill ${smartBannerConfig.id === "review-vale-a-pena" ? "active" : ""}`}
                  onClick={() => handleLoadPreset("review-vale-a-pena")}
                >
                  Review: Vale a Pena?
                </button>
                <button
                  type="button"
                  className={`preset-pill ${smartBannerConfig.id === "setup-custo-beneficio" ? "active" : ""}`}
                  onClick={() => handleLoadPreset("setup-custo-beneficio")}
                >
                  Setup Custo-Benefício
                </button>
                <button
                  type="button"
                  className={`preset-pill ${smartBannerConfig.id === "shorts-achado-hoje" ? "active" : ""}`}
                  onClick={() => handleLoadPreset("shorts-achado-hoje")}
                >
                  Shorts 9:16 Achado
                </button>
                <button
                  type="button"
                  className={`preset-pill ${smartBannerConfig.id === "shorts-3-itens" ? "active" : ""}`}
                  onClick={() => handleLoadPreset("shorts-3-itens")}
                >
                  Shorts 9:16 3 Itens
                </button>
              </div>
            </div>

            {/* Proporção de Tela */}
            <div className="field-compact">
              <label>Proporção &amp; Formato</label>
              <div className="ratio-toggle-group">
                <button
                  type="button"
                  className={smartBannerConfig.aspectRatio === "16:9" ? "active" : ""}
                  onClick={() =>
                    setSmartBannerConfig({ ...smartBannerConfig, aspectRatio: "16:9" })
                  }
                >
                  16:9 Capa de Vídeo
                </button>
                <button
                  type="button"
                  className={smartBannerConfig.aspectRatio === "9:16" ? "active" : ""}
                  onClick={() =>
                    setSmartBannerConfig({ ...smartBannerConfig, aspectRatio: "9:16" })
                  }
                >
                  9:16 Reels / TikTok
                </button>
                <button
                  type="button"
                  className={smartBannerConfig.aspectRatio === "1:1" ? "active" : ""}
                  onClick={() =>
                    setSmartBannerConfig({ ...smartBannerConfig, aspectRatio: "1:1" })
                  }
                >
                  1:1 Feed / Vitrine
                </button>
              </div>
            </div>

            {/* Arquétipo de Conteúdo */}
            <div className="field-compact">
              <label>Arquétipo de Banner</label>
              <select
                value={smartBannerConfig.archetype}
                onChange={(e) =>
                  handleArchetypeChange(e.target.value as BannerTemplateArchetype)
                }
              >
                {Object.entries(BANNER_ARCHETYPES).map(([key, arch]) => (
                  <option key={key} value={key}>
                    {arch.name} ({arch.defaultHeadline})
                  </option>
                ))}
              </select>
            </div>

            {/* Expressão do Mascote SMK */}
            <div className="field-compact">
              <label>Expressão do Mascote SMK 3D</label>
              <select
                value={smartBannerConfig.mascotExpression}
                onChange={(e) =>
                  setSmartBannerConfig({
                    ...smartBannerConfig,
                    mascotExpression: e.target.value as MascotExpression,
                  })
                }
              >
                {Object.entries(MASCOT_EXPRESSIONS).map(([key, exp]) => (
                  <option key={key} value={key}>
                    {exp.label} · {exp.description}
                  </option>
                ))}
              </select>
            </div>

            {/* Título Principal (Sora ExtraBold) */}
            <div className="field-compact">
              <label>Título Principal (Sora ExtraBold)</label>
              <input
                type="text"
                value={smartBannerConfig.headline}
                onChange={(e) =>
                  setSmartBannerConfig({ ...smartBannerConfig, headline: e.target.value })
                }
                placeholder="Ex.: TOP 5 ACHADOS"
              />
            </div>

            {/* Palavra de Destaque (Pill Colorida) */}
            <div className="field-compact">
              <label>Palavra / Frase de Destaque (Caixa)</label>
              <input
                type="text"
                value={smartBannerConfig.highlightWord || ""}
                onChange={(e) =>
                  setSmartBannerConfig({
                    ...smartBannerConfig,
                    highlightWord: e.target.value,
                  })
                }
                placeholder="Ex.: DA SHOPEE ou ATÉ R$300"
              />
            </div>

            {/* Selo / Badge Superior */}
            <div className="field-compact">
              <label>Selo Superior (Badge)</label>
              <input
                type="text"
                value={smartBannerConfig.badgeText}
                onChange={(e) =>
                  setSmartBannerConfig({ ...smartBannerConfig, badgeText: e.target.value })
                }
                placeholder="Ex.: 🔥 ACHADOS DA SHOPEE"
              />
            </div>

            {/* Preço / Tag de Oferta */}
            <div className="field-compact">
              <label>Preço / Tag de Oferta</label>
              <input
                type="text"
                value={smartBannerConfig.priceTag || ""}
                onChange={(e) =>
                  setSmartBannerConfig({ ...smartBannerConfig, priceTag: e.target.value })
                }
                placeholder="Ex.: R$ 79,90 ou ATÉ R$300"
              />
            </div>

            {/* Subtítulo */}
            <div className="field-compact">
              <label>Subtítulo Explicativo (Inter)</label>
              <input
                type="text"
                value={smartBannerConfig.subheadline || ""}
                onChange={(e) =>
                  setSmartBannerConfig({
                    ...smartBannerConfig,
                    subheadline: e.target.value,
                  })
                }
                placeholder="Ex.: Melhores recomendações testadas"
              />
            </div>

            {/* HUD Holográfico */}
            <div className="field-compact">
              <label>HUD Holográfico Flutuante</label>
              <div className="hud-config-row">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={smartBannerConfig.showHolographicHud}
                    onChange={(e) =>
                      setSmartBannerConfig({
                        ...smartBannerConfig,
                        showHolographicHud: e.target.checked,
                      })
                    }
                  />
                  <span>Ativar Painel Neon</span>
                </label>
                {smartBannerConfig.showHolographicHud && (
                  <select
                    value={smartBannerConfig.hudContent || "headphone"}
                    onChange={(e) =>
                      setSmartBannerConfig({
                        ...smartBannerConfig,
                        hudContent: e.target.value as SmartBannerConfig["hudContent"],
                      })
                    }
                  >
                    <option value="headphone">🎧 Headphone / Áudio</option>
                    <option value="discount">🏷️ Porcentagem % Desconto</option>
                    <option value="verified">✓ Selo Aprovado</option>
                    <option value="tech">💻 Hardware / Monitor</option>
                    <option value="speaker">🔊 Speaker / Gadget</option>
                  </select>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ABA 2: Mockup 3D (Photoshop REA) */}
      {activeTab === "mockup-3d" && (
        <div className="mockup-studio-grid">
          <div className="mockup-preview-stage" style={{ perspective: transforms3D.containerPerspective }}>
            <div
              className={`mockup-3d-item ${mockupKind}`}
              style={{
                transform: transforms3D.bookTransform,
                boxShadow: transforms3D.shadow,
                background: themeStyles.backgroundGradient,
                borderColor: themeStyles.borderStroke,
              }}
            >
              {/* Lombada lateral 3D */}
              <div
                className="mockup-spine"
                style={{
                  width: transforms3D.spineWidth,
                  backgroundColor: themeStyles.spineColor,
                  borderColor: themeStyles.borderStroke,
                }}
              >
                <span className="spine-text" style={{ color: themeStyles.textColor }}>
                  {mockupTitle} · SMKON
                </span>
              </div>

              {/* Capa Principal */}
              <div className="mockup-cover-face">
                <span className="mockup-brand-tag" style={{ color: themeStyles.accentColor }}>
                  SMKON · DIGITAL EXCLUSIVE
                </span>
                <h3 className="mockup-face-title" style={{ color: themeStyles.textColor }}>
                  {mockupTitle}
                </h3>
                <p className="mockup-face-subtitle" style={{ color: themeStyles.subtextColor }}>
                  {mockupSubtitle}
                </p>
                <div className="mockup-face-footer">
                  <span className="mockup-badge" style={{ backgroundColor: themeStyles.accentColor, color: "#000" }}>
                    100% PRÁTICO
                  </span>
                  <small style={{ color: themeStyles.subtextColor }}>Edição 2026</small>
                </div>
              </div>
            </div>
          </div>

          <div className="mockup-controls-card">
            <h4 className="controls-title">Configurações do Mockup 3D</h4>

            <div className="field-compact">
              <label>Formato 3D</label>
              <select
                value={mockupKind}
                onChange={(e) => setMockupKind(e.target.value as MockKindSafe)}
              >
                <option value="ebook-3d">E-book 3D com Lombada Realista</option>
                <option value="bundle-box-3d">Caixa de Produto Digital / Bundle</option>
                <option value="tablet-app">Tablet Digital / App</option>
                <option value="device-mockup">Smartphone Showcase</option>
              </select>
            </div>

            <div className="field-compact">
              <label>Paleta de Cores &amp; Acabamento</label>
              <select
                value={mockupTheme}
                onChange={(e) => setMockupTheme(e.target.value as MockupColorTheme)}
              >
                {Object.values(MOCKUP_THEMES).map((th) => (
                  <option key={th.id} value={th.id}>
                    {th.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="field-compact">
              <label>Título na Capa</label>
              <input
                type="text"
                value={mockupTitle}
                onChange={(e) => setMockupTitle(e.target.value)}
                placeholder="Ex.: Manual dos Achadinhos Virais"
              />
            </div>

            <div className="field-compact">
              <label>Subtítulo / Promessa Principal</label>
              <input
                type="text"
                value={mockupSubtitle}
                onChange={(e) => setMockupSubtitle(e.target.value)}
                placeholder="Ex.: Do Zero a R$ 5.000/Mês como Afiliado"
              />
            </div>
          </div>
        </div>
      )}

      {/* ABA 3: Banners Promocionais & Stories (Canva REA) */}
      {activeTab === "banner-promo" && (
        <div className="banner-studio-grid">
          <div className="banner-preview-stage">
            <div className={`promo-banner-card ${bannerConfig.format}`}>
              <div className="banner-top-bar">
                <span className="banner-badge" style={{ backgroundColor: activeBadge.bg, color: activeBadge.text }}>
                  {bannerConfig.badgeCustomText || activeBadge.label}
                </span>
                <span className="banner-brand">{bannerConfig.brandTag}</span>
              </div>

              <div className="banner-content-body">
                <h3 className="banner-title">{bannerConfig.headline}</h3>
                <p className="banner-desc">{bannerConfig.subheadline}</p>

                <div className="banner-price-tag">
                  {bannerConfig.originalPrice && (
                    <span className="original-price">{bannerConfig.originalPrice}</span>
                  )}
                  <strong className="sale-price">{bannerConfig.salePrice}</strong>
                  {bannerConfig.installments && (
                    <small className="installments-text">{bannerConfig.installments}</small>
                  )}
                </div>
              </div>

              {/* Sticker Interativo simulado de Story */}
              {bannerConfig.format === "story-vertical" && bannerConfig.interactiveSticker?.type === "poll" && (
                <div className="story-poll-sticker">
                  <p className="poll-question">{bannerConfig.interactiveSticker.question}</p>
                  <div className="poll-options">
                    <button type="button" className="poll-opt">
                      {bannerConfig.interactiveSticker.optionA}
                    </button>
                    <button type="button" className="poll-opt">
                      {bannerConfig.interactiveSticker.optionB}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="mockup-controls-card">
            <h4 className="controls-title">Editor de Banners Promocionais</h4>

            <div className="field-compact">
              <label>Formato do Banner</label>
              <select
                value={bannerConfig.format}
                onChange={(e) =>
                  setBannerConfig({ ...bannerConfig, format: e.target.value as BannerFormat })
                }
              >
                <option value="feed-square">Feed Quadrado (1:1)</option>
                <option value="story-vertical">Story Vertical (9:16) com Enquete</option>
              </select>
            </div>

            <div className="field-compact">
              <label>Selo de Conversão (Badge)</label>
              <select
                value={bannerConfig.badge}
                onChange={(e) =>
                  setBannerConfig({
                    ...bannerConfig,
                    badge: e.target.value as ConversionBadgeType,
                  })
                }
              >
                <option value="best-seller">🔥 Nº 1 Mais Vendido</option>
                <option value="free-shipping">🚚 Frete Grátis Hoje</option>
                <option value="discount-tag">🏷️ Até 70% OFF</option>
                <option value="limited-stock">⚡ Restam Poucas Unidades</option>
                <option value="verified-stars">⭐ Avaliação 4.9/5.0</option>
              </select>
            </div>

            <div className="field-compact">
              <label>Título do Produto / Oferta</label>
              <input
                type="text"
                value={bannerConfig.headline}
                onChange={(e) => setBannerConfig({ ...bannerConfig, headline: e.target.value })}
              />
            </div>

            <div className="field-compact">
              <label>Preço Promocional</label>
              <input
                type="text"
                value={bannerConfig.salePrice}
                onChange={(e) => setBannerConfig({ ...bannerConfig, salePrice: e.target.value })}
              />
            </div>
          </div>
        </div>
      )}

      {/* ABA 4: Fábrica de Infoprodutos Digitais (S25) */}
      {activeTab === "infoproduct-factory" && (
        <div className="infoproduct-factory-grid">
          <div className="blueprint-selector-pane">
            <h4>Catálogo de Infoprodutos Prontos para Venda</h4>
            <div className="blueprint-cards-list">
              {INFOPRODUCT_BLUEPRINTS.map((bp) => (
                <button
                  key={bp.id}
                  type="button"
                  className={`blueprint-card ${selectedBlueprint.id === bp.id ? "active" : ""}`}
                  onClick={() => setSelectedBlueprint(bp)}
                >
                  <span className="blueprint-tier-badge">{bp.pricingTier.toUpperCase()}</span>
                  <strong>{bp.title}</strong>
                  <p>{bp.subtitle}</p>
                  <div className="blueprint-card-footer">
                    <span>Preço: R$ {bp.recommendedPriceBrl.toFixed(2)}</span>
                    <small>{bp.chapters.length} Capítulos Completos</small>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="blueprint-detail-pane">
            <div className="blueprint-detail-head">
              <div>
                <span className="niche-tag">{selectedBlueprint.niche}</span>
                <h3>{selectedBlueprint.title}</h3>
                <p className="blueprint-sub">{selectedBlueprint.subtitle}</p>
              </div>
              <div className="blueprint-actions">
                <button
                  type="button"
                  className="button button-small button-secondary"
                  onClick={() => setShowPreviewModal(true)}
                >
                  👁️ Prévia Completa
                </button>
                <button
                  type="button"
                  className="button button-small button-primary"
                  onClick={handleDownloadHtml}
                >
                  ⬇️ Baixar HTML/PDF
                </button>
              </div>
            </div>

            <div className="blueprint-sales-box">
              <strong>Copy de Vendas Rápida:</strong>
              <p>&ldquo;{selectedBlueprint.salesCopySummary}&rdquo;</p>
              <div className="checkout-cta-box">
                <span>Botão de Checkout:</span>
                <strong>{selectedBlueprint.checkoutCta}</strong>
              </div>
            </div>

            <div className="blueprint-chapters-list">
              <h4>Estrutura dos Capítulos:</h4>
              {selectedBlueprint.chapters.map((chap) => (
                <div key={chap.number} className="chapter-summary-card">
                  <div className="chap-title-line">
                    <span className="chap-num">Capítulo {chap.number}</span>
                    <strong>{chap.title}</strong>
                  </div>
                  <p className="chap-hook">{chap.hookSummary}</p>
                  <ul className="chap-action-pills">
                    {chap.actionChecklist.map((act, i) => (
                      <li key={i}>✓ {act}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Modal de Prévia Completa do Infoproduto */}
      {showPreviewModal && (
        <div className="modal-backdrop">
          <div className="modal-container-large">
            <div className="modal-header">
              <h3>Prévia do Infoproduto: {selectedBlueprint.title}</h3>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setShowPreviewModal(false)}
              >
                ✕
              </button>
            </div>
            <div className="modal-body-frame">
              <iframe
                title="Prévia do Infoproduto"
                srcDoc={compiledHtml}
                className="infoproduct-iframe"
              />
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="button button-secondary"
                onClick={() => setShowPreviewModal(false)}
              >
                Fechar
              </button>
              <button
                type="button"
                className="button button-primary"
                onClick={handleDownloadHtml}
              >
                Baixar Arquivo Completo
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

type MockKindSafe = MockupKind;
