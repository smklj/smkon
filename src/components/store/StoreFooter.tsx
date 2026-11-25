import React from "react";
import Link from "next/link";
import Image from "next/image";
import type { StoreSettings } from "@/lib/store/types";

export function StoreFooter({ settings }: { settings: StoreSettings }) {
  return (
    <footer className="store-footer">
      <div className="store-footer-container">
        <div className="store-footer-col" style={{ maxWidth: "340px" }}>
          <Image
            src={settings.logo_url || "/brand/smkon-logo-horizontal-white.svg"}
            alt="SMKON"
            width={120}
            height={28}
            style={{ height: 28, width: "auto", objectFit: "contain", marginBottom: "16px" }}
          />
          <p style={{ lineHeight: "1.6", color: "var(--store-muted)", fontSize: "13px" }}>
            {settings.store_tagline || "Achados inteligentes. Escolhas melhores."} A loja oficial de tecnologia, periféricos testados, seleções Shopee e soluções digitais para o seu ecossistema.
          </p>
          <div style={{ display: "flex", gap: "12px", marginTop: "16px" }}>
            {settings.social_links.instagram && (
              <a href={settings.social_links.instagram} target="_blank" rel="noopener noreferrer">
                Instagram ↗
              </a>
            )}
            {settings.social_links.tiktok && (
              <a href={settings.social_links.tiktok} target="_blank" rel="noopener noreferrer">
                TikTok ↗
              </a>
            )}
            {settings.social_links.youtube && (
              <a href={settings.social_links.youtube} target="_blank" rel="noopener noreferrer">
                YouTube ↗
              </a>
            )}
          </div>
        </div>

        <div className="store-footer-col">
          <h5>Categorias</h5>
          <ul>
            <li><Link href="/loja/produtos?categoria=achados">Achados da Shopee</Link></li>
            <li><Link href="/loja/produtos?categoria=tecnologia">Tecnologia & Periféricos</Link></li>
            <li><Link href="/loja/produtos?categoria=reviews">Reviews & Testados</Link></li>
            <li><Link href="/loja/produtos?tipo=digital">Infoprodutos & E-books</Link></li>
            <li><Link href="/loja/produtos">Todos os Produtos</Link></li>
          </ul>
        </div>

        <div className="store-footer-col">
          <h5>Atendimento & Ajuda</h5>
          <ul>
            <li>
              <span>Email: </span>
              <a href={`mailto:${settings.support_email || "suporte@smkon.com.br"}`}>
                {settings.support_email || "suporte@smkon.com.br"}
              </a>
            </li>
            {settings.support_whatsapp && (
              <li>
                <span>WhatsApp: </span>
                <a href={`https://wa.me/${settings.support_whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer">
                  Suporte Direto ↗
                </a>
              </li>
            )}
            <li><Link href="/loja/pedido/rastrear">Rastrear Pedido</Link></li>
            <li><Link href="/admin">Painel Administrativo SMKON</Link></li>
          </ul>
        </div>

        <div className="store-footer-col">
          <h5>Compra 100% Segura</h5>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px", fontSize: "12px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ color: "var(--store-accent)", fontSize: "16px" }}>🔒</span>
              <span>Criptografia SSL de ponta a ponta</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ color: "var(--store-success)", fontSize: "16px" }}>⚡</span>
              <span>PIX Oficial com confirmação instantânea</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ color: "var(--store-primary)", fontSize: "16px" }}>📦</span>
              <span>Logística integrada Melhor Envio / Correios</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ color: "var(--store-warning)", fontSize: "16px" }}>🛡️</span>
              <span>Garantia de satisfação SMKON</span>
            </div>
          </div>
        </div>
      </div>

      <div className="store-footer-bottom">
        <div>
          © {new Date().getFullYear()} SMKON Tecnologia e Comércio Ltda. Todos os direitos reservados.
        </div>
        <div style={{ display: "flex", gap: "16px" }}>
          <span>Termos de Uso</span>
          <span>Política de Privacidade (LGPD)</span>
          <span>Trocas e Devoluções</span>
        </div>
      </div>
    </footer>
  );
}
