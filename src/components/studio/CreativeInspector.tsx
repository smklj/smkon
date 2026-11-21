"use client";

import { useMemo } from "react";
import {
  SUBTITLE_THEMES,
  type SubtitleStyle,
} from "@/lib/media/subtitles";
import {
  VIRAL_HOOKS,
  type ViralHook,
  type WatermarkConfig,
  type WatermarkPosition,
} from "@/lib/media/video-composition";

interface CreativeInspectorProps {
  subtitleStyle: SubtitleStyle;
  onSubtitleStyleChange: (style: SubtitleStyle) => void;
  selectedHookId?: string;
  onHookSelect: (hook: ViralHook) => void;
  watermark: WatermarkConfig;
  onWatermarkChange: (watermark: WatermarkConfig) => void;
  promoCode?: string;
  onPromoCodeChange: (code: string) => void;
  onApplyHookToScript?: (hookText: string) => void;
  disabled?: boolean;
}

export function CreativeInspector({
  subtitleStyle,
  onSubtitleStyleChange,
  selectedHookId,
  onHookSelect,
  watermark,
  onWatermarkChange,
  promoCode,
  onPromoCodeChange,
  onApplyHookToScript,
  disabled = false,
}: CreativeInspectorProps) {
  const stylesList = useMemo(() => Object.values(SUBTITLE_THEMES), []);

  const handlePositionChange = (position: WatermarkPosition) => {
    onWatermarkChange({ ...watermark, position });
  };

  const handleOutroToggle = (showCtaOutro: boolean) => {
    onWatermarkChange({ ...watermark, showCtaOutro });
  };

  const handleOutroTextChange = (outroCtaText: string) => {
    onWatermarkChange({ ...watermark, outroCtaText });
  };

  const handleBadgeTextChange = (badgeText: string) => {
    onWatermarkChange({ ...watermark, badgeText });
  };

  const currentHook = useMemo(() => {
    return VIRAL_HOOKS.find((h) => h.id === selectedHookId) || VIRAL_HOOKS[0];
  }, [selectedHookId]);

  return (
    <div className="creative-inspector-panel">
      <div className="creative-inspector-head">
        <div>
          <p className="eyebrow">Content Studio Pro · REA</p>
          <h3>Inspetor Criativo & Vídeo 9:16</h3>
        </div>
        <span className="creative-badge-tag">CapCut / Canva REA</span>
      </div>

      <div className="creative-inspector-sections">
        {/* Estilo de Legenda Dinâmica (CapCut / Hormozi) */}
        <div className="inspector-group">
          <label className="inspector-label">
            <span>Estilo de Legenda Karaokê</span>
            <small>Destaque animado palavra por palavra com emojis virais</small>
          </label>
          <div className="style-preset-grid">
            {stylesList.map((st) => (
              <button
                key={st.id}
                type="button"
                className={`style-preset-btn ${subtitleStyle === st.id ? "active" : ""}`}
                onClick={() => onSubtitleStyleChange(st.id)}
                disabled={disabled}
              >
                <span
                  className="style-swatch"
                  style={{
                    backgroundColor: st.activeColor,
                    borderColor: st.strokeColor,
                  }}
                />
                <div className="style-info">
                  <strong>{st.label}</strong>
                  <small>{st.textTransform === "uppercase" ? "CAIXA ALTA" : "Normal"}</small>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Gancho Viral (0-3s Hook) */}
        <div className="inspector-group">
          <div className="inspector-row-head">
            <label className="inspector-label">
              <span>Gancho Viral de Retenção (0–3s)</span>
              <small>Retenção comprovada para Reels, TikTok e Shorts</small>
            </label>
            {onApplyHookToScript && (
              <button
                type="button"
                className="button-link-accent"
                onClick={() => onApplyHookToScript(currentHook.text)}
                disabled={disabled}
              >
                + Injetar no Roteiro
              </button>
            )}
          </div>
          <select
            className="inspector-select"
            value={selectedHookId || currentHook.id}
            onChange={(e) => {
              const found = VIRAL_HOOKS.find((h) => h.id === e.target.value);
              if (found) onHookSelect(found);
            }}
            disabled={disabled}
          >
            {VIRAL_HOOKS.map((hook) => (
              <option key={hook.id} value={hook.id}>
                {hook.badge} — {hook.text.substring(0, 50)}...
              </option>
            ))}
          </select>
          <div className="hook-preview-box">
            <span className="hook-badge-preview">{currentHook.badge}</span>
            <p className="hook-text-preview">&ldquo;{currentHook.text}&rdquo;</p>
          </div>
        </div>

        {/* Marca d'Água SMKON e Proteção de Propriedade */}
        <div className="inspector-group">
          <label className="inspector-label">
            <span>Marca d&apos;Água SMKON & Proteção Anti-Cópia</span>
            <small>Remoção de marca de terceiros e aplicação da nossa marca</small>
          </label>
          <div className="inspector-fields-grid">
            <div className="field-compact">
              <label>Selo / Badge</label>
              <input
                type="text"
                value={watermark.badgeText || ""}
                onChange={(e) => handleBadgeTextChange(e.target.value)}
                placeholder="SMKON · OFICIAL"
                disabled={disabled}
              />
            </div>
            <div className="field-compact">
              <label>Posição</label>
              <select
                value={watermark.position}
                onChange={(e) => handlePositionChange(e.target.value as WatermarkPosition)}
                disabled={disabled}
              >
                <option value="top-right">Superior Direito (Recomendado)</option>
                <option value="top-left">Superior Esquerdo</option>
                <option value="bottom-right">Inferior Direito</option>
                <option value="bottom-left">Inferior Esquerdo</option>
                <option value="bottom-center">Centro Inferior</option>
              </select>
            </div>
          </div>
        </div>

        {/* Cupom e Gatilhos de Afiliado (Shein, Shopee, Kiwify) */}
        <div className="inspector-group">
          <label className="inspector-label">
            <span>Conversão de Afiliado / Oferta</span>
            <small>Cupom promocional destacado no vídeo e na legenda</small>
          </label>
          <div className="field-compact">
            <label>Código do Cupom de Desconto</label>
            <input
              type="text"
              value={promoCode || ""}
              onChange={(e) => onPromoCodeChange(e.target.value.toUpperCase())}
              placeholder="Ex.: SMKON10, SHEIN20, PROMO50"
              disabled={disabled}
            />
          </div>
        </div>

        {/* Card Final de Chamada para Ação (CTA Outro) */}
        <div className="inspector-group">
          <div className="inspector-checkbox-line">
            <label className="toggle-label">
              <input
                type="checkbox"
                checked={watermark.showCtaOutro}
                onChange={(e) => handleOutroToggle(e.target.checked)}
                disabled={disabled}
              />
              <span>Exibir Card Final de CTA nos últimos 3 segundos</span>
            </label>
          </div>
          {watermark.showCtaOutro && (
            <div className="field-compact mt-2">
              <label>Texto da Chamada Final</label>
              <input
                type="text"
                value={watermark.outroCtaText}
                onChange={(e) => handleOutroTextChange(e.target.value)}
                placeholder="Link e Cupom Exclusivo nos Comentários / Bio ⚡"
                disabled={disabled}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
