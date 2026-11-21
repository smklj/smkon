/**
 * Tipografia das peças SVG sem elemento <style>.
 *
 * A CSP do SMKON só aceita <style> com o nonce da resposta, e um SVG injetado como HTML
 * não tem esse nonce: o bloco de estilo era descartado e a peça perdia pesos e espaçamento.
 * Atributos de apresentação do SVG (font-weight="900") não são CSS inline e não passam
 * pela CSP. Eles também valem quando o SVG vira imagem para exportar PNG.
 *
 * Na tela, o globals.css aplica as fontes do próprio app às mesmas classes (folha de
 * estilo vence atributo de apresentação). Nenhuma fonte externa é carregada.
 */
export const SVG_TYPE_ATTRIBUTES: Record<string, Record<string, string>> = {
  "sora-title": { "font-family": "Sora, 'Space Grotesk', system-ui, sans-serif", "font-weight": "900", "letter-spacing": "-0.03em" },
  "sora-badge": { "font-family": "Sora, 'Space Grotesk', system-ui, sans-serif", "font-weight": "800", "letter-spacing": "0.04em" },
  "inter-body": { "font-family": "Inter, system-ui, sans-serif" },
};

const OPEN_TAG = /<([a-zA-Z][\w:-]*)(\s[^<>]*?)?(\/?)>/g;

/** Acrescenta os atributos de tipografia a cada tag com uma das classes, sem duplicar atributos já presentes. */
export function applySvgTypography(svg: string): string {
  return svg.replace(OPEN_TAG, (tag, name: string, attrs: string | undefined, selfClose: string) => {
    if (!attrs) return tag;
    const classMatch = /\sclass="([^"]*)"/.exec(attrs);
    if (!classMatch) return tag;
    const additions: string[] = [];
    for (const className of classMatch[1].split(/\s+/)) {
      const typography = SVG_TYPE_ATTRIBUTES[className];
      if (!typography) continue;
      for (const [attr, value] of Object.entries(typography)) {
        const present = new RegExp(`\\s${attr}=`).test(attrs) || additions.some((item) => item.startsWith(`${attr}=`));
        if (!present) additions.push(`${attr}="${value}"`);
      }
    }
    if (!additions.length) return tag;
    return `<${name}${attrs} ${additions.join(" ")}${selfClose}>`;
  });
}
