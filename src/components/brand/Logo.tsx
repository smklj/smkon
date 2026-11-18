/**
 * Logo oficial SMKON (identidade monocromática), desenhado em SVG com currentColor.
 * Geometria idêntica ao kit de marca em public/brand.
 */

type LogoProps = {
  variant?: "symbol" | "horizontal";
  className?: string;
  title?: string;
};

function Symbol() {
  return (
    <g fill="currentColor" stroke="currentColor">
      <polygon points="226,45 662,45 606,95 226,95" stroke="none" />
      <path d="M232 70 A105 105 0 0 0 232 280 L385 280 A80 80 0 0 1 458 393" fill="none" strokeWidth="50" />
      <path d="M80 735 L80 330 L350 610 L762 252" fill="none" strokeWidth="50" strokeMiterlimit="10" />
      <path d="M560 548 L770 728" fill="none" strokeWidth="50" />
    </g>
  );
}

const WORDMARK = [
  { x: 0, d: "M72 18 C62 4 22 0 12 22 C2 46 34 49 46 51 C64 54 84 62 76 82 C66 104 22 100 6 80" },
  { x: 124, d: "M4 100 L4 4 L48 72 L92 4 L92 100" },
  { x: 266, d: "M4 0 L4 100 M76 0 L4 60 M28 40 L78 100" },
  { x: 392, d: "M52 4 A48 48 0 1 1 51.9 4 Z" },
  { x: 542, d: "M4 100 L4 4 L80 96 L80 0" },
];

export function Logo({ variant = "horizontal", className, title = "SMKON" }: LogoProps) {
  if (variant === "symbol") {
    return (
      <svg className={className} viewBox="0 0 840 760" role="img" aria-label={title}>
        <title>{title}</title>
        <Symbol />
      </svg>
    );
  }

  return (
    <svg className={className} viewBox="0 0 1180 300" role="img" aria-label={title}>
      <title>{title}</title>
      <g transform="translate(0 22) scale(0.33)">
        <Symbol />
      </g>
      <g transform="translate(370 90) scale(1.15)" fill="none" stroke="currentColor" strokeWidth="8" strokeMiterlimit="10">
        {WORDMARK.map((letter) => (
          <path key={letter.x} transform={`translate(${letter.x} 0)`} d={letter.d} />
        ))}
      </g>
    </svg>
  );
}
