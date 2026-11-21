/**
 * Motor de Mockups 3D e Capas de Infoprodutos (Engenharia Reversa Photoshop / Canva 3D)
 * Gera transformações CSS 3D realistas, iluminação, sombras e acabamento gráfico para produtos digitais.
 */

export type MockupKind = "ebook-3d" | "bundle-box-3d" | "tablet-app" | "device-mockup";

export type MockupColorTheme = "gold-black" | "cyber-neon" | "clean-minimal" | "royal-purple";

export type MockupOptions = {
  title: string;
  subtitle: string;
  authorOrBrand: string;
  kind: MockupKind;
  theme: MockupColorTheme;
  badge?: string;
  highlightPrice?: string;
  originalPrice?: string;
};

export type MockupThemeStyles = {
  id: MockupColorTheme;
  name: string;
  backgroundGradient: string;
  accentColor: string;
  textColor: string;
  subtextColor: string;
  spineColor: string;
  borderStroke: string;
};

export const MOCKUP_THEMES: Record<MockupColorTheme, MockupThemeStyles> = {
  "gold-black": {
    id: "gold-black",
    name: "Ouro & Black Edition",
    backgroundGradient: "linear-gradient(145deg, #18181b 0%, #09090b 100%)",
    accentColor: "#F59E0B",
    textColor: "#FFFFFF",
    subtextColor: "#A1A1AA",
    spineColor: "#050506",
    borderStroke: "rgba(245, 158, 11, 0.4)",
  },
  "cyber-neon": {
    id: "cyber-neon",
    name: "Cyber Neon Glow",
    backgroundGradient: "linear-gradient(145deg, #0d1b2a 0%, #000814 100%)",
    accentColor: "#00F0FF",
    textColor: "#FFFFFF",
    subtextColor: "#70E000",
    spineColor: "#020B14",
    borderStroke: "rgba(0, 240, 255, 0.45)",
  },
  "clean-minimal": {
    id: "clean-minimal",
    name: "Clean Editorial",
    backgroundGradient: "linear-gradient(145deg, #27272a 0%, #18181b 100%)",
    accentColor: "#E4E4E7",
    textColor: "#FFFFFF",
    subtextColor: "#A1A1AA",
    spineColor: "#09090b",
    borderStroke: "rgba(255, 255, 255, 0.15)",
  },
  "royal-purple": {
    id: "royal-purple",
    name: "Royal Creator",
    backgroundGradient: "linear-gradient(145deg, #2e1065 0%, #0f051d 100%)",
    accentColor: "#C084FC",
    textColor: "#FFFFFF",
    subtextColor: "#E9D5FF",
    spineColor: "#08020f",
    borderStroke: "rgba(192, 132, 252, 0.4)",
  },
};

/**
 * Retorna os cálculos de perspectiva e estilo CSS 3D baseados no tipo de mockup.
 */
export function getMockup3DTransforms(kind: MockupKind) {
  switch (kind) {
    case "ebook-3d":
      return {
        containerPerspective: "1200px",
        bookTransform: "rotateY(-24deg) rotateX(8deg) rotateZ(-2deg)",
        spineWidth: "32px",
        shadow: "24px 28px 45px -10px rgba(0, 0, 0, 0.85), 0 0 20px rgba(0, 0, 0, 0.5)",
      };
    case "bundle-box-3d":
      return {
        containerPerspective: "1400px",
        bookTransform: "rotateY(-28deg) rotateX(5deg)",
        spineWidth: "55px",
        shadow: "30px 35px 55px -8px rgba(0, 0, 0, 0.9), 0 0 25px rgba(0, 0, 0, 0.6)",
      };
    case "tablet-app":
      return {
        containerPerspective: "1000px",
        bookTransform: "rotateY(-12deg) rotateX(10deg)",
        spineWidth: "12px",
        shadow: "18px 24px 35px -8px rgba(0, 0, 0, 0.75)",
      };
    case "device-mockup":
    default:
      return {
        containerPerspective: "900px",
        bookTransform: "rotateY(-8deg) rotateX(6deg)",
        spineWidth: "16px",
        shadow: "16px 20px 30px -8px rgba(0, 0, 0, 0.7)",
      };
  }
}
