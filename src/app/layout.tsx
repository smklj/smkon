import type { Metadata, Viewport } from "next";
import { connection } from "next/server";
import { Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";

const display = Space_Grotesk({ subsets: ["latin"], variable: "--font-display", display: "swap" });
const sans = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });

export const metadata: Metadata = {
  title: { default: "SMKON", template: "%s | SMKON" },
  description: "SMKON — plataforma de operação digital.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#0B0B0B",
  colorScheme: "dark",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // CSP com nonce (S6.1): toda página precisa ser renderizada por requisição para receber o nonce.
  await connection();
  return (
    <html lang="pt-BR" className={`${display.variable} ${sans.variable}`}>
      <body>{children}</body>
    </html>
  );
}
