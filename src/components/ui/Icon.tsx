/** Conjunto de ícones de sistema (traço 1.5, 24×24), sem dependências externas. */

export type IconName =
  | "overview"
  | "strategy"
  | "products"
  | "content"
  | "agents"
  | "finance"
  | "legal"
  | "audience"
  | "security"
  | "store"
  | "menu"
  | "close"
  | "logout"
  | "check"
  | "clock"
  | "archive"
  | "arrow-right"
  | "chevron-left"
  | "chevron-right";

const PATHS: Record<IconName, string> = {
  overview: "M4 4h7v7H4zM13 4h7v4h-7zM13 10h7v10h-7zM4 13h7v7H4z",
  strategy: "M4 20V10M10 20V4M16 20v-7M22 20H2",
  products: "M3 7l9-4 9 4-9 4-9-4zM3 7v10l9 4 9-4V7M12 11v10",
  content: "M4 5h16v14H4zM10 9l5 3-5 3z",
  agents: "M9 3h6M12 3v3M6 6h12a2 2 0 012 2v9a2 2 0 01-2 2H6a2 2 0 01-2-2V8a2 2 0 012-2zM9 12h.01M15 12h.01M9 16h6",
  finance: "M3 7h18v12H3zM3 11h18M7 15h4",
  legal: "M12 3v18M5 7h14M7 7l-3 7a3 3 0 006 0zM17 7l-3 7a3 3 0 006 0zM8 21h8",
  audience: "M16 19v-1a4 4 0 00-4-4H7a4 4 0 00-4 4v1M9.5 10a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM21 19v-1a4 4 0 00-3-3.87M15 3.13a3.5 3.5 0 010 6.75",
  security: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6zM9 12l2 2 4-4",
  store: "M3 9l1-5h16l1 5v1a3 3 0 01-6 0 3 3 0 01-6 0 3 3 0 01-5-1V9zm1 5v7h16v-7M9 21v-6h6v6",
  menu: "M4 7h16M4 12h16M4 17h16",
  close: "M6 6l12 12M18 6L6 18",
  logout: "M15 4h4v16h-4M10 8l-4 4 4 4M6 12h11",
  check: "M5 12l5 5L20 7",
  clock: "M12 21a9 9 0 100-18 9 9 0 000 18zM12 7v5l3 2",
  archive: "M3 4h18v4H3zM5 8v12h14V8M10 12h4",
  "arrow-right": "M5 12h14M13 6l6 6-6 6",
  "chevron-left": "M15 6l-6 6 6 6",
  "chevron-right": "M9 6l6 6-6 6",
};

type IconProps = {
  name: IconName;
  size?: number;
  className?: string;
  title?: string;
};

export function Icon({ name, size = 18, className, title }: IconProps) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
    >
      {title ? <title>{title}</title> : null}
      <path d={PATHS[name]} />
    </svg>
  );
}
