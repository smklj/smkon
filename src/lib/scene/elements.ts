/**
 * Elementos de marca do documento de cena: os desenhos oficiais do SMKON (fundo,
 * grade, halo, logo, mascote SMK, indicador de carrossel, marcador de tópico),
 * extraídos sem alteração visual dos geradores de banner e post anteriores.
 *
 * Cada elemento declara os seus parâmetros (validados em schema.ts) e devolve
 * as definições SVG (gradientes, filtros) e o corpo, desenhado na origem: o
 * renderizador posiciona com translate(x, y) e scale.
 */
import { SMKON_BRAND_TOKENS } from "../media/brand-system.ts";
import type { BrandPropValue } from "./types.ts";

export type PropSpec =
  | { type: "enum"; values: readonly string[]; required?: boolean }
  | { type: "number"; min: number; max: number; required?: boolean }
  | { type: "int"; min: number; max: number; required?: boolean }
  | { type: "color"; required?: boolean };

export type ElementProps = Record<string, BrandPropValue>;

export type ElementContext = {
  /** Dimensões do documento (fundo e grade ocupam a peça toda). */
  width: number;
  height: number;
  /** Prefixo único na página para ids de gradientes e filtros. */
  uid: string;
};

export type ElementRender = { defs: string[]; body: string };

export type BrandElementSpec = {
  label: string;
  /** Ocupa a peça inteira (desenha com width/height do documento): não se move nem escala ao mudar o formato. */
  fullBleed?: boolean;
  props: Record<string, PropSpec>;
  render(props: ElementProps, ctx: ElementContext): ElementRender;
};

const EXPRESSIONS = ["padrao", "feliz", "pensativo", "surpreso", "confirmado", "oferta"] as const;
const HUD_CONTENTS = ["none", "headphone", "speaker", "verified", "discount", "tech"] as const;

const str = (props: ElementProps, key: string, fallback = ""): string =>
  typeof props[key] === "string" ? (props[key] as string) : fallback;
const num = (props: ElementProps, key: string, fallback = 0): number =>
  typeof props[key] === "number" ? (props[key] as number) : fallback;

/** Olhos do mascote por expressão (iguais nas versões completa e compacta). */
function mascotEyes(expression: string): string {
  switch (expression) {
    case "feliz":
    case "confirmado":
      return `
        <path d="M-28 -8 Q-20 -20 -12 -8" stroke="#11161F" stroke-width="7" stroke-linecap="round" fill="none" />
        <path d="M12 -8 Q20 -20 28 -8" stroke="#11161F" stroke-width="7" stroke-linecap="round" fill="none" />`;
    case "pensativo":
      return `
        <rect x="-30" y="-14" width="16" height="24" rx="8" fill="#11161F" />
        <line x1="12" y1="-2" x2="28" y2="-2" stroke="#11161F" stroke-width="7" stroke-linecap="round" />`;
    case "surpreso":
      return `
        <circle cx="-20" cy="-6" r="12" fill="#11161F" />
        <circle cx="-17" cy="-9" r="4" fill="#FFFFFF" />
        <circle cx="20" cy="-6" r="12" fill="#11161F" />
        <circle cx="23" cy="-9" r="4" fill="#FFFFFF" />`;
    case "oferta":
      return `
        <path d="M-28 -8 Q-20 -20 -12 -8" stroke="#11161F" stroke-width="7" stroke-linecap="round" fill="none" />
        <circle cx="20" cy="-6" r="10" fill="#11161F" />
        <circle cx="23" cy="-9" r="3.5" fill="#FFFFFF" />`;
    default:
      return `
        <rect x="-30" y="-15" width="18" height="26" rx="9" fill="#11161F" />
        <rect x="12" y="-15" width="18" height="26" rx="9" fill="#11161F" />`;
  }
}

/** Painel holográfico ao lado do mascote completo. */
function hudPanel(content: string, accent: string, x: number, y: number): string {
  let icon: string;
  if (content === "headphone") {
    icon = `
        <path d="M-14 4 A14 14 0 0 1 14 4" stroke="${accent}" stroke-width="3" fill="none" stroke-linecap="round" />
        <rect x="-18" y="2" width="6" height="12" rx="3" fill="${accent}" />
        <rect x="12" y="2" width="6" height="12" rx="3" fill="${accent}" />`;
  } else if (content === "verified") {
    icon = `
        <polygon points="0,-14 5,-9 12,-11 10,-4 15,2 9,6 8,13 2,10 -3,14 -6,8 -13,6 -10,0 -14,-6 -7,-8" fill="${accent}" />
        <path d="M-4 0 L-1 3 L5 -3" stroke="#FFFFFF" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none" />`;
  } else if (content === "discount") {
    icon = `
        <circle cx="0" cy="0" r="13" fill="${accent}" />
        <text x="0" y="5" font-family="Sora, sans-serif" font-weight="800" font-size="13" fill="#FFFFFF" text-anchor="middle">%</text>`;
  } else {
    icon = `
        <rect x="-12" y="-10" width="24" height="16" rx="2" stroke="${accent}" stroke-width="2.5" fill="none" />
        <line x1="-5" y1="9" x2="5" y2="9" stroke="${accent}" stroke-width="2" />
        <line x1="0" y1="6" x2="0" y2="9" stroke="${accent}" stroke-width="2" />`;
  }
  return `
      <g transform="translate(${x}, ${y})">
        <rect x="-42" y="-35" width="84" height="70" rx="10" fill="#090B0F" fill-opacity="0.75" stroke="${accent}" stroke-width="1.8" />
        <path d="M-36 -31 L-40 -31 L-40 -27" stroke="${accent}" stroke-width="2" fill="none" />
        <path d="M36 -31 L40 -31 L40 -27" stroke="${accent}" stroke-width="2" fill="none" />
        <path d="M-36 31 L-40 31 L-40 27" stroke="${accent}" stroke-width="2" fill="none" />
        <path d="M36 31 L40 31 L40 27" stroke="${accent}" stroke-width="2" fill="none" />
        ${icon}
      </g>`;
}

export const BRAND_ELEMENTS: Record<string, BrandElementSpec> = {
  "smk-backdrop": {
    label: "Fundo cósmico SMKON",
    fullBleed: true,
    props: { variant: { type: "enum", values: ["banner", "post"], required: true } },
    render(props, ctx) {
      const post = str(props, "variant") === "post";
      const id = `${ctx.uid}-bg`;
      const stops = post
        ? `<stop offset="0%" stop-color="#080D12" /><stop offset="40%" stop-color="#11161F" /><stop offset="100%" stop-color="#070A0E" />`
        : `<stop offset="0%" stop-color="#080D12" /><stop offset="50%" stop-color="#0E141C" /><stop offset="100%" stop-color="#06090D" />`;
      return {
        defs: [`<linearGradient id="${id}" x1="0%" y1="0%" x2="100%" y2="100%">${stops}</linearGradient>`],
        body: `<rect width="${ctx.width}" height="${ctx.height}" fill="url(#${id})" />`,
      };
    },
  },

  "smk-grid": {
    label: "Grade tecnológica",
    fullBleed: true,
    props: {
      rows: { type: "int", min: 1, max: 64, required: true },
      cols: { type: "int", min: 1, max: 64, required: true },
      opacity: { type: "number", min: 0, max: 1, required: true },
      color: { type: "color" },
    },
    render(props, ctx) {
      const rows = num(props, "rows", 8);
      const cols = num(props, "cols", 12);
      const color = str(props, "color", "#2563FF");
      const lines: string[] = [];
      for (let i = 0; i <= rows; i += 1) {
        const y = (ctx.height / rows) * i;
        lines.push(`<line x1="0" y1="${y}" x2="${ctx.width}" y2="${y}" />`);
      }
      for (let i = 0; i <= cols; i += 1) {
        const x = (ctx.width / cols) * i;
        lines.push(`<line x1="${x}" y1="0" x2="${x}" y2="${ctx.height}" />`);
      }
      return {
        defs: [],
        body: `<g stroke="${color}" stroke-opacity="${num(props, "opacity", 0.05)}" stroke-width="1">${lines.join("\n")}</g>`,
      };
    },
  },

  "smk-halo": {
    label: "Halo de luz",
    props: {
      r: { type: "number", min: 1, max: 4096, required: true },
      accent: { type: "color", required: true },
      secondary: { type: "color", required: true },
      inner: { type: "number", min: 0, max: 1, required: true },
      mid: { type: "number", min: 0, max: 1, required: true },
    },
    render(props, ctx) {
      const id = `${ctx.uid}-halo`;
      return {
        defs: [
          `<radialGradient id="${id}" cx="50%" cy="50%" r="50%">` +
            `<stop offset="0%" stop-color="${str(props, "accent")}" stop-opacity="${num(props, "inner")}" />` +
            `<stop offset="60%" stop-color="${str(props, "secondary")}" stop-opacity="${num(props, "mid")}" />` +
            `<stop offset="100%" stop-color="#080D12" stop-opacity="0" />` +
            `</radialGradient>`,
        ],
        body: `<circle cx="0" cy="0" r="${num(props, "r")}" fill="url(#${id})" />`,
      };
    },
  },

  "smk-logo": {
    label: "Logo SMKON",
    props: { variant: { type: "enum", values: ["banner", "post"], required: true } },
    render(props, ctx) {
      const id = `${ctx.uid}-swoosh`;
      const defs = [
        `<linearGradient id="${id}" x1="0%" y1="0%" x2="100%" y2="0%">` +
          `<stop offset="0%" stop-color="#2563FF" /><stop offset="60%" stop-color="#00F0FF" /><stop offset="100%" stop-color="#FFFFFF" />` +
          `</linearGradient>`,
      ];
      if (str(props, "variant") === "post") {
        return {
          defs,
          body: `
        <text class="sora-title" x="0" y="30" font-size="28" fill="#FFFFFF">SMK<tspan fill="#287BFF">ON</tspan></text>
        <path d="M-4 36 C 36 38, 70 20, 95 6" stroke="url(#${id})" stroke-width="3" fill="none" stroke-linecap="round" />
        <circle cx="98" cy="5" r="2" fill="#00F0FF" />`,
        };
      }
      return {
        defs,
        body: `
        <text class="sora-title" x="0" y="32" font-size="34" fill="#FFFFFF">SMK<tspan fill="#287BFF">ON</tspan></text>
        <path d="M-6 40 C 45 42, 90 20, 118 6" stroke="url(#${id})" stroke-width="3.5" fill="none" stroke-linecap="round" />
        <g transform="translate(122, 5)">
          <path d="M0 -6 L1.5 -1.5 L6 0 L1.5 1.5 L0 6 L-1.5 1.5 L-6 0 L-1.5 -1.5 Z" fill="#00F0FF" />
          <circle cx="0" cy="0" r="1.5" fill="#FFFFFF" />
        </g>
        <text class="inter-body" x="0" y="52" font-size="12" font-weight="600" fill="#94A3B8" letter-spacing="0.02em">${SMKON_BRAND_TOKENS.slogan}</text>`,
      };
    },
  },

  "smk-mascot": {
    label: "Mascote SMK",
    props: {
      variant: { type: "enum", values: ["full", "compact"], required: true },
      expression: { type: "enum", values: EXPRESSIONS, required: true },
      accent: { type: "color", required: true },
      hud: { type: "enum", values: HUD_CONTENTS },
      hudX: { type: "number", min: -2000, max: 2000 },
      hudY: { type: "number", min: -2000, max: 2000 },
    },
    render(props, ctx) {
      const accent = str(props, "accent");
      const expression = str(props, "expression", "padrao");
      const hood = `${ctx.uid}-hood`;
      const face = `${ctx.uid}-face`;

      if (str(props, "variant") === "compact") {
        return {
          defs: [
            `<linearGradient id="${hood}" x1="20%" y1="0%" x2="80%" y2="100%"><stop offset="0%" stop-color="#2A3440" /><stop offset="50%" stop-color="#141922" /><stop offset="100%" stop-color="#080A0E" /></linearGradient>`,
            `<linearGradient id="${face}" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#FFFFFF" /><stop offset="100%" stop-color="#E2E8F0" /></linearGradient>`,
          ],
          body: `
        <path d="M-65 120 C-65 30 -50 5 0 5 C50 5 65 30 65 120 Z" fill="url(#${hood})" />
        <path d="M-50 120 L-15 55 L8 60 L-25 120 Z" fill="#FFFFFF" />
        <circle cx="-10" cy="62" r="4" fill="#00F0FF" />
        <path d="M-55 -35 C-55 -85 -40 -105 0 -105 C40 -105 55 -85 55 -35 C55 20 40 40 0 40 C-40 40 -55 20 -55 -35 Z" fill="url(#${hood})" />
        <rect x="-40" y="-48" width="80" height="70" rx="30" fill="url(#${face})" />
        ${mascotEyes(expression)}
        <rect x="-68" y="-48" width="18" height="48" rx="9" fill="#141922" stroke="${accent}" stroke-width="2.5" />
        <rect x="50" y="-48" width="18" height="48" rx="9" fill="#141922" stroke="${accent}" stroke-width="2.5" />`,
        };
      }

      const sash = `${ctx.uid}-sash`;
      const glow = `${ctx.uid}-glow`;
      const hud = str(props, "hud", "none");
      const thumbsUp =
        expression === "confirmado"
          ? `
        <g transform="translate(-85, 40)">
          <ellipse cx="0" cy="0" rx="16" ry="14" fill="#1E2633" />
          <rect x="-4" y="-22" width="10" height="18" rx="5" fill="#2A3445" />
          <circle cx="1" cy="-20" r="5" fill="#2A3445" />
        </g>`
          : "";
      return {
        defs: [
          `<linearGradient id="${hood}" x1="20%" y1="0%" x2="80%" y2="100%"><stop offset="0%" stop-color="#2C3440" /><stop offset="45%" stop-color="#141922" /><stop offset="100%" stop-color="#080A0E" /></linearGradient>`,
          `<linearGradient id="${face}" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#FFFFFF" /><stop offset="100%" stop-color="#E2E8F0" /></linearGradient>`,
          `<linearGradient id="${sash}" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#FFFFFF" /><stop offset="100%" stop-color="#CBD5E1" /></linearGradient>`,
          `<filter id="${glow}" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="8" result="blur" /><feComposite in="SourceGraphic" in2="blur" operator="over" /></filter>`,
        ],
        body: `
        <path d="M-75 140 C-75 40 -60 10 0 10 C60 10 75 40 75 140 Z" fill="url(#${hood})" />
        <path d="M-60 140 L-20 65 L8 70 L-30 140 Z" fill="url(#${sash})" />
        <circle cx="-12" cy="74" r="5" fill="#00F0FF" filter="url(#${glow})" />
        <circle cx="-12" cy="74" r="2.5" fill="#FFFFFF" />
        <path d="M-65 -40 C-65 -95 -45 -115 0 -115 C45 -115 65 -95 65 -40 C65 25 45 45 0 45 C-45 45 -65 25 -65 -40 Z" fill="url(#${hood})" />
        <path d="M-60 -70 C-30 -110 30 -110 60 -70 C40 -95 -40 -95 -60 -70 Z" fill="#3B4656" />
        <rect x="-46" y="-55" width="92" height="82" rx="36" fill="url(#${face})" />
        ${mascotEyes(expression)}
        <g transform="translate(-70, -25)">
          <rect x="-14" y="-30" width="22" height="58" rx="11" fill="#141922" stroke="${accent}" stroke-width="2.5" />
          <circle cx="-3" cy="-1" r="7" fill="#080D12" />
          <text class="sora-title" x="-3" y="2.5" font-size="8" fill="${accent}" text-anchor="middle">S</text>
        </g>
        <g transform="translate(70, -25)">
          <rect x="-8" y="-30" width="22" height="58" rx="11" fill="#141922" stroke="${accent}" stroke-width="2.5" />
          <circle cx="3" cy="-1" r="7" fill="#080D12" />
          <text class="sora-title" x="3" y="2.5" font-size="8" fill="${accent}" text-anchor="middle">S</text>
        </g>
        <path d="M-70 -35 C-70 -115 70 -115 70 -35" stroke="#1A202C" stroke-width="8" fill="none" stroke-linecap="round" />
        ${thumbsUp}
        ${hud === "none" ? "" : hudPanel(hud, accent, num(props, "hudX"), num(props, "hudY"))}`,
      };
    },
  },

  "carousel-dots": {
    label: "Indicador de carrossel",
    props: {
      index: { type: "int", min: 1, max: 20, required: true },
      total: { type: "int", min: 1, max: 20, required: true },
      accent: { type: "color", required: true },
    },
    render(props) {
      const index = num(props, "index", 1);
      const total = num(props, "total", 1);
      const accent = str(props, "accent");
      const dots = Array.from({ length: total }, (_, i) => {
        const active = i + 1 === index;
        return `<rect x="${i * 20}" y="0" width="${active ? 28 : 10}" height="8" rx="4" fill="${active ? accent : "#2A2F3A"}" />`;
      }).join("");
      return {
        defs: [],
        body: `${dots}<text font-family="'Sora', sans-serif" font-weight="700" font-size="14" fill="#94A3B8" x="${total * 20 + 20}" y="9">${index}/${total}</text>`,
      };
    },
  },

  "check-bullet": {
    label: "Marcador de tópico",
    props: { accent: { type: "color", required: true } },
    render(props) {
      const accent = str(props, "accent");
      return {
        defs: [],
        body: `
        <rect x="0" y="0" width="34" height="34" rx="8" fill="#1F2733" stroke="${accent}" stroke-width="2" />
        <path d="M10 17 L15 22 L24 12" stroke="${accent}" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round" />`,
      };
    },
  },
};

export function isBrandElement(element: string): boolean {
  return Object.prototype.hasOwnProperty.call(BRAND_ELEMENTS, element);
}
