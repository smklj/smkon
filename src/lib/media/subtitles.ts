/**
 * Motor de legendas dinâmicas em karaokê (Engenharia Reversa CapCut / Hormozi Style)
 * Suporta alinhamento temporal palavra por palavra, destaque de cor animado e injeção automática de emojis virais.
 */

export type WordCaption = {
  word: string;
  start: number; // segundos
  end: number;   // segundos
  emoji?: string;
  highlightColor?: string;
};

export type SubtitleSegment = {
  start: number;
  end: number;
  text: string;
  words: WordCaption[];
};

export type SubtitleStyle = "hormozi" | "viral_neon" | "cyber_pink" | "clean_white";

export type SubtitleTheme = {
  id: SubtitleStyle;
  label: string;
  activeColor: string;
  inactiveColor: string;
  strokeColor: string;
  strokeWidth: string;
  fontSize: string;
  fontFamily: string;
  fontWeight: string;
  textTransform: "uppercase" | "none";
  shadow: string;
};

export const SUBTITLE_THEMES: Record<SubtitleStyle, SubtitleTheme> = {
  hormozi: {
    id: "hormozi",
    label: "Hormozi Gold",
    activeColor: "#FFD700", // Amarelo Ouro
    inactiveColor: "#FFFFFF",
    strokeColor: "#000000",
    strokeWidth: "4px",
    fontSize: "2.1rem",
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Montserrat', 'Impact', sans-serif",
    fontWeight: "900",
    textTransform: "uppercase",
    shadow: "0px 4px 12px rgba(0,0,0,0.9)",
  },
  viral_neon: {
    id: "viral_neon",
    label: "Viral Neon",
    activeColor: "#00FF66", // Verde Elétrico
    inactiveColor: "#F0F0F0",
    strokeColor: "#051A05",
    strokeWidth: "3px",
    fontSize: "2.0rem",
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
    fontWeight: "800",
    textTransform: "uppercase",
    shadow: "0 0 16px rgba(0,255,102,0.8)",
  },
  cyber_pink: {
    id: "cyber_pink",
    label: "TikTok Pink",
    activeColor: "#FF007F", // Rosa Choque
    inactiveColor: "#FFFFFF",
    strokeColor: "#200010",
    strokeWidth: "3px",
    fontSize: "2.0rem",
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
    fontWeight: "800",
    textTransform: "uppercase",
    shadow: "0 0 14px rgba(255,0,127,0.7)",
  },
  clean_white: {
    id: "clean_white",
    label: "Clean Minimal",
    activeColor: "#FFFFFF",
    inactiveColor: "#9E9E9E",
    strokeColor: "rgba(0,0,0,0.7)",
    strokeWidth: "2px",
    fontSize: "1.8rem",
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
    fontWeight: "700",
    textTransform: "none",
    shadow: "0 2px 8px rgba(0,0,0,0.6)",
  },
};

/** Dicionário de emojis automáticos para gatilhos virais em e-commerce e afiliados */
const VIRAL_EMOJI_TRIGGERS: Record<string, string> = {
  dinheiro: "💰",
  grana: "💸",
  lucro: "📈",
  pix: "⚡",
  fogo: "🔥",
  top: "🔥",
  incrivel: "✨",
  chocante: "😱",
  absurdo: "🤯",
  segredo: "🤫",
  truque: "💡",
  hack: "⚡",
  cupom: "🎟️",
  desconto: "🏷️",
  promocao: "🏷️",
  gratis: "🎁",
  presente: "🎁",
  loja: "🛍️",
  comprar: "🛒",
  shein: "👗",
  shopee: "📦",
  mercado: "📦",
  atencao: "⚠️",
  alerta: "🚨",
  urgente: "🚨",
  urgencia: "🚨",
  cuidado: "⚠️",
  pare: "🛑",
  rapido: "⏱️",
  hoje: "📅",
  agora: "⏰",
  casa: "🏠",
  cozinha: "🍳",
  beleza: "💄",
  pele: "✨",
  cabelo: "💇‍♀️",
  celular: "📱",
};

/** Normaliza palavra retirando pontuação e acentos para correspondência de emoji */
function normalizeWord(raw: string): string {
  return raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w]/g, "");
}

export function detectWordEmoji(rawWord: string): string | undefined {
  const clean = normalizeWord(rawWord);
  if (!clean) return undefined;
  return VIRAL_EMOJI_TRIGGERS[clean];
}

/**
 * Converte um roteiro ou texto livre em blocos de legendas dinâmicas
 * com alinhamento temporal aproximado e quebras curtas de 3 a 5 palavras.
 */
export function parseScriptToSubtitles(
  scriptText: string,
  totalDurationSeconds = 15,
): SubtitleSegment[] {
  // Limpa cabeçalhos como "HOOK (0-3s)", "DESENVOLVIMENTO", etc.
  const cleanedText = scriptText
    .replace(/^[A-ZÁÉÍÓÚÂÊÔÃÕÇ\s()0-9–-]+:/gim, "")
    .replace(/\b(HOOK|DESENVOLVIMENTO|DEMONSTRAÇÃO|PROVA|FECHAMENTO|CTA)\b[^\n]*/gi, "")
    .trim();

  const allWords = cleanedText
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length > 0);

  if (allWords.length === 0) return [];

  // Ritmo médio falado: ~3 palavras por segundo
  const duration = Math.max(totalDurationSeconds, allWords.length * 0.35);
  const timePerWord = duration / allWords.length;

  const segments: SubtitleSegment[] = [];
  const wordsPerSegment = 3; // Estilo CapCut: blocos de 3 palavras na tela por vez

  for (let i = 0; i < allWords.length; i += wordsPerSegment) {
    const chunkWords = allWords.slice(i, i + wordsPerSegment);
    const segStartTime = Number((i * timePerWord).toFixed(2));
    const segEndTime = Number((Math.min(i + chunkWords.length, allWords.length) * timePerWord).toFixed(2));

    const wordCaptions: WordCaption[] = chunkWords.map((word, wordIdx) => {
      const wStart = Number((segStartTime + wordIdx * timePerWord).toFixed(2));
      const wEnd = Number((wStart + timePerWord).toFixed(2));
      const emoji = detectWordEmoji(word);
      return {
        word,
        start: wStart,
        end: wEnd,
        emoji,
      };
    });

    segments.push({
      start: segStartTime,
      end: segEndTime,
      text: chunkWords.join(" "),
      words: wordCaptions,
    });
  }

  return segments;
}

/**
 * Retorna o segmento ativo e o índice da palavra sendo pronunciada no segundo exato.
 */
export function getActiveSubtitle(
  segments: SubtitleSegment[],
  currentTime: number,
): { segment: SubtitleSegment | null; activeWordIndex: number } {
  for (const seg of segments) {
    if (currentTime >= seg.start && currentTime <= seg.end) {
      let wordIndex = -1;
      for (let i = 0; i < seg.words.length; i++) {
        if (currentTime >= seg.words[i].start && currentTime <= seg.words[i].end) {
          wordIndex = i;
          break;
        }
      }
      return { segment: seg, activeWordIndex: wordIndex === -1 ? 0 : wordIndex };
    }
  }
  return { segment: null, activeWordIndex: -1 };
}
