import React from "react";
import Link from "next/link";
import Image from "next/image";
import type { StoreSettings } from "@/lib/store/types";
import { IconArrowUpRight, IconPackage, IconShield, IconZap } from "./StoreIcons";

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
            style={{ height: 26, width: "auto", objectFit: "contain", marginBottom: "16px" }}
          />
          <p style={{ lineHeight: "1.65", color: "var(--store-muted)", fontSize: "13px" }}>
            {settings.store_tagline || "Achados inteligentes. Escolhas melhores."} Tecnologia, periféricos selecionados, infoprodutos digitais e engenharia de software em um único ecossistema.
          </p>
          <div style={{ display: "flex", gap: "14px", marginTop: "16px", fontSize: "12px" }}>
            {settings.social_links.instagram && (
              <a href={settings.social_links.instagram} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: "3px" }}>
                <span>Instagram</span>
                <IconArrowUpRight size={12} />
              </a>
            )}
            {settings.social_links.tiktok && (
              <a href={settings.social_links.tiktok} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: "3px" }}>
                <span>TikTok</span>
                <IconArrowUpRight size={12} />
              </a>
            )}
            {settings.social_links.youtube && (
              <a href={settings.social_links.youtube} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: "3px" }}>
                <span>YouTube</span>
                <IconArrowUpRight size={12} />
              </a>
            )}
          </div>
        </div>

        <div className="store-footer-col">
          <h5>Categorias</h5>
          <ul>
            <li><Link href="/loja/produtos?tipo=fisico">Hardware & Periféricos</Link></li>
            <li><Link href="/loja/produtos?tipo=digital">Infoprodutos & Sistemas</Link></li>
            <li><Link href="/loja/produtos?tipo=shopee">Achados da Shopee</Link></li>
            <li><Link href="/loja/orcamentos">Sites, APIs & Orçamentos</Link></li>
            <li><Link href="/loja/produtos">Catálogo Completo</Link></li>
          </ul>
        </div>

        <div className="store-footer-col">
          <h5>Atendimento & Ajuda</h5>
          <ul>
            <li>
              <span>E-mail: </span>
              <a href={`mailto:${settings.support_email || "suporte@smkon.com.br"}`}>
                {settings.support_email || "suporte@smkon.com.br"}
              </a>
            </li>
            {settings.support_whatsapp && (
              <li>
                <span>WhatsApp: </span>
                <a href={`https://wa.me/${settings.support_whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer">
                  Atendimento Direto
                </a>
              </li>
            )}
            <li><Link href="/loja/rastrear">Rastrear Pedido</Link></li>
            <li><Link href="/painel">Painel Administrativo</Link></li>
          </ul>
        </div>

        <div className="store-footer-col">
          <h5>Segurança & Pagamento</h5>
          <div style={{ display: "flex", flexDirection: "column", gap: "11px", fontSize: "12px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#d4d4d8" }}>
              <span style={{ color: "var(--store-accent)" }}><IconShield size={15} /></span>
              <span>Criptografia SSL 256-bit ponta a ponta</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#d4d4d8" }}>
              <span style={{ color: "var(--store-accent)" }}><IconZap size={15} /></span>
              <span>PIX com confirmação em tempo real</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#d4d4d8" }}>
              <span style={{ color: "var(--store-accent)" }}><IconPackage size={15} /></span>
              <span>Envio rastreado Correios & transportadoras</span>
            </div>
          </div>
        </div>
      </div>

      <div className="store-footer-bottom">
        <div>
          © {new Date().getFullYear()} SMKON Tecnologia e Comércio. Todos os direitos reservados.
        </div>
        <div style={{ display: "flex", gap: "16px" }}>
          <span>Termos de Uso</span>
          <span>Privacidade (LGPD)</span>
          <span>Trocas e Devoluções</span>
        </div>
      </div>
    </footer>
  );
}
