import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SMKON | Control Center",
  description: "Central de inteligência e operação da SMKON."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
