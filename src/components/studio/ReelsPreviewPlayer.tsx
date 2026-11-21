"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import {
  getActiveSubtitle,
  parseScriptToSubtitles,
  SUBTITLE_THEMES,
  type SubtitleStyle,
} from "@/lib/media/subtitles";
import type { WatermarkConfig, ViralHook } from "@/lib/media/video-composition";

interface ReelsPreviewPlayerProps {
  sourceVideoUrl?: string;
  script: string;
  subtitleStyle: SubtitleStyle;
  hook?: ViralHook;
  watermark: WatermarkConfig;
  affiliateTag?: string;
  promoCode?: string;
}

export function ReelsPreviewPlayer({
  sourceVideoUrl,
  script,
  subtitleStyle,
  hook,
  watermark,
  promoCode,
}: ReelsPreviewPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const totalDuration = 15; // 15 segundos padrão para Reels/TikTok

  const theme = useMemo(() => SUBTITLE_THEMES[subtitleStyle] || SUBTITLE_THEMES.hormozi, [subtitleStyle]);
  const segments = useMemo(() => parseScriptToSubtitles(script, totalDuration), [script]);

  const animationFrameRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const pausedTimeRef = useRef<number>(0);

  // Loop de reprodução em tempo real
  useEffect(() => {
    if (isPlaying) {
      startTimeRef.current = performance.now() - pausedTimeRef.current * 1000;

      const tick = (now: number) => {
        const elapsed = (now - startTimeRef.current) / 1000;
        if (elapsed >= totalDuration) {
          setCurrentTime(0);
          pausedTimeRef.current = 0;
          setIsPlaying(false);
        } else {
          setCurrentTime(elapsed);
          animationFrameRef.current = requestAnimationFrame(tick);
        }
      };

      animationFrameRef.current = requestAnimationFrame(tick);
    } else {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      pausedTimeRef.current = currentTime;
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPlaying, currentTime, totalDuration]);

  const togglePlay = () => setIsPlaying((prev) => !prev);

  const resetPlay = () => {
    setIsPlaying(false);
    setCurrentTime(0);
    pausedTimeRef.current = 0;
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = Number(e.target.value);
    setCurrentTime(newTime);
    pausedTimeRef.current = newTime;
    startTimeRef.current = performance.now() - newTime * 1000;
  };

  // Determina legenda ativa no segundo atual
  const { segment: activeSegment, activeWordIndex } = useMemo(() => {
    return getActiveSubtitle(segments, currentTime);
  }, [segments, currentTime]);

  const isShowingHook = currentTime < 3 && Boolean(hook?.text);
  const isShowingOutro = watermark.showCtaOutro && currentTime >= totalDuration - watermark.outroDurationSeconds;

  return (
    <div className="reels-mockup-container">
      {/* Moldura de Smartphone 9:16 */}
      <div className="reels-smartphone-frame">
        {/* Notch / Speaker */}
        <div className="reels-notch">
          <span className="notch-speaker" />
          <span className="notch-camera" />
        </div>

        {/* Camada de Vídeo / Background Visual */}
        <div className="reels-viewport">
          {sourceVideoUrl ? (
            <video
              src={sourceVideoUrl}
              className="reels-video-element"
              playsInline
              muted
              loop
            />
          ) : (
            <div className="reels-ambient-bg">
              <div className="ambient-orb orb-1" />
              <div className="ambient-orb orb-2" />
              <div className="ambient-grid-overlay" />
              <div className="ambient-placeholder-text">
                <span>⚡ DEMONSTRAÇÃO DO PRODUTO</span>
                <p>Vídeo vertical 9:16 preparado para o algoritmo</p>
              </div>
            </div>
          )}

          {/* Marca d'Água Oficial SMKON */}
          <div className={`reels-watermark-overlay ${watermark.position}`} style={{ opacity: watermark.opacity }}>
            <div className="watermark-badge">
              <span className="watermark-icon">✦</span>
              <strong className="watermark-title">{watermark.brandName}</strong>
              {watermark.badgeText && <small className="watermark-sub">{watermark.badgeText}</small>}
            </div>
          </div>

          {/* Gancho dos Primeiros 3 Segundos (Hook) */}
          {isShowingHook && hook && (
            <div className="reels-hook-card">
              <span className="hook-badge">{hook.badge}</span>
              <p className="hook-text">"{hook.text}"</p>
            </div>
          )}

          {/* Legenda Dinâmica em Karaokê (CapCut REA) */}
          {!isShowingOutro && activeSegment && (
            <div className="reels-captions-wrapper">
              <div className="reels-captions-box">
                {activeSegment.words.map((w, idx) => {
                  const isActive = idx === activeWordIndex;
                  return (
                    <span
                      key={`${w.word}_${idx}`}
                      className={`caption-word ${isActive ? "active" : "inactive"}`}
                      style={{
                        fontFamily: theme.fontFamily,
                        fontSize: theme.fontSize,
                        fontWeight: theme.fontWeight,
                        textTransform: theme.textTransform,
                        color: isActive ? theme.activeColor : theme.inactiveColor,
                        WebkitTextStroke: `${theme.strokeWidth} ${theme.strokeColor}`,
                        textShadow: theme.shadow,
                      }}
                    >
                      {w.word}
                      {w.emoji && <span className="caption-emoji">{w.emoji}</span>}
                      {" "}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {/* Card Final de Chamada para Ação (CTA Outro) */}
          {isShowingOutro && (
            <div className="reels-outro-card">
              <span className="outro-pulse-icon">🛍️</span>
              <strong className="outro-title">GARANTA COM DESCONTO</strong>
              <p className="outro-text">{watermark.outroCtaText}</p>
              {promoCode && (
                <div className="outro-coupon">
                  <span>CUPOM:</span>
                  <strong>{promoCode}</strong>
                </div>
              )}
            </div>
          )}

          {/* UI Social Overlay (Ícones laterais Instagram/TikTok) */}
          <div className="reels-social-hud">
            <div className="hud-action"><span>❤️</span><small>42.8k</small></div>
            <div className="hud-action"><span>💬</span><small>1.2k</small></div>
            <div className="hud-action"><span>🚀</span><small>Share</small></div>
            <div className="hud-action"><span>🔖</span><small>Save</small></div>
          </div>

          {/* Botão de Play Central ao Pausar */}
          {!isPlaying && (
            <button
              type="button"
              className="reels-play-overlay-button"
              onClick={togglePlay}
              aria-label="Reproduzir vídeo"
            >
              ▶
            </button>
          )}
        </div>

        {/* Barra de Progresso do Smartphone */}
        <div className="reels-progress-bar">
          <div
            className="progress-fill"
            style={{ width: `${(currentTime / totalDuration) * 100}%` }}
          />
        </div>
      </div>

      {/* Controles de Reprodução Externos */}
      <div className="reels-player-controls">
        <button
          type="button"
          className="button button-small button-secondary"
          onClick={togglePlay}
        >
          {isPlaying ? "⏸ Pausar" : "▶ Play"}
        </button>
        <button
          type="button"
          className="button button-small button-secondary"
          onClick={resetPlay}
        >
          ↺ Início
        </button>
        <input
          type="range"
          min="0"
          max={totalDuration}
          step="0.1"
          value={currentTime}
          onChange={handleSeek}
          className="reels-scrub-slider"
          aria-label="Timeline do vídeo"
        />
        <span className="reels-time-display">
          {currentTime.toFixed(1)}s / {totalDuration}s
        </span>
      </div>
    </div>
  );
}
