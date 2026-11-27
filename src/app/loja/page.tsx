import React from "react";
import Link from "next/link";
import { getStoreSettings, listStoreProducts } from "@/lib/store/repository";
import { HeroBanner } from "@/components/store/HeroBanner";
import { FlashDealsBar } from "@/components/store/FlashDealsBar";
import { ProductCard } from "@/components/store/ProductCard";
import { SmartDiscoveryShelf } from "@/components/store/SmartDiscoveryShelf";
import {
  IconArrowUpRight,
  IconCheck,
  IconCode,
  IconShield,
  IconTruck,
  IconZap,
} from "@/components/store/StoreIcons";

export const revalidate = 60;

export default async function LojaHomePage() {
  const settings = await getStoreSettings();

  // Cada seção busca sua categoria real para evitar cards repetidos na vitrine
  const [physicalRes, digitalRes, shopeeRes] = await Promise.all([
    listStoreProducts({ fulfillmentMode: "internal_physical", limit: 8 }),
    listStoreProducts({ fulfillmentMode: "internal_digital", limit: 4 }),
    listStoreProducts({ fulfillmentMode: "external_affiliate", limit: 4 }),
  ]);

  const allProducts = Array.from(
    new Map(
      [...physicalRes.products, ...digitalRes.products, ...shopeeRes.products].map((p) => [p.id, p]),
    ).values(),
  );

  const isDemoMode = allProducts.some((p) => p.id.startsWith("demo-"));

  return (
    <>
      {/* 1. Hero Principal */}
      <HeroBanner banners={settings.hero_banners} />

      {/* 2. Faixa de Confiança Compacta (1 linha limpa, sem caixas gigantes) */}
      <section className="store-benefits-strip" aria-label="Garantias da loja">
        <div className="store-benefit-item">
          <IconZap size={15} />
          <span>PIX com aprovação instantânea</span>
        </div>
        <div className="store-benefit-item">
          <IconTruck size={15} />
          <span>Envio rastreado para todo o Brasil</span>
        </div>
        <div className="store-benefit-item">
          <IconCheck size={15} />
          <span>Entrega digital imediata</span>
        </div>
        <div className="store-benefit-item">
          <IconShield size={15} />
          <span>Compra segura e curadoria verificada</span>
        </div>
      </section>

      {isDemoMode && (
        <div
          style={{
            marginBottom: "24px",
            padding: "10px 16px",
            borderRadius: "10px",
            background: "rgba(212, 175, 55, 0.08)",
            border: "1px solid rgba(212, 175, 55, 0.28)",
            fontSize: "12px",
            color: "#e4e4e7",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "8px",
          }}
        >
          <span>Vitrine em modo demonstração visual — cadastre seus produtos no painel para publicar automaticamente.</span>
          <Link href="/admin/loja" style={{ color: "var(--store-accent)", fontWeight: 600, textDecoration: "none" }}>
            Gerenciar no Painel ↗
          </Link>
        </div>
      )}

      {/* 3. Barra Deslizante Inteligente + Vitrine Principal */}
      <SmartDiscoveryShelf products={allProducts}>
        {/* Ofertas do Dia + Produtos Físicos / Hardware */}
        <section className="store-section">
          <FlashDealsBar />

          <div className="store-section-header">
            <div>
              <span className="store-section-kicker">Loja Própria · Envio Rastrado</span>
              <h2 className="store-section-title">Hardware, Setup & Periféricos</h2>
            </div>
            <Link href="/loja/produtos?tipo=fisico" className="store-section-link">
              <span>Ver todos</span>
              <IconArrowUpRight size={14} />
            </Link>
          </div>

          {physicalRes.products.length > 0 ? (
            <div className="store-grid">
              {physicalRes.products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          ) : (
            <p style={{ color: "var(--store-muted)", fontSize: "13px" }}>
              Nenhum produto físico publicado no momento.
            </p>
          )}
        </section>

        {/* Infoprodutos, Sistemas PDV & Soluções Digitais */}
        {digitalRes.products.length > 0 && (
          <section className="store-section store-section-panel">
            <div className="store-section-header">
              <div>
                <span className="store-section-kicker">Liberação Automática Pós-Pagamento</span>
                <h2 className="store-section-title">Infoprodutos, Sistemas PDV & Planilhas</h2>
              </div>
              <Link href="/loja/produtos?tipo=digital" className="store-section-link">
                <span>Ver soluções digitais</span>
                <IconArrowUpRight size={14} />
              </Link>
            </div>

            <div className="store-grid">
              {digitalRes.products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </section>
        )}

        {/* Curadoria Oficial Shopee */}
        {shopeeRes.products.length > 0 && (
          <section className="store-section store-section-shopee">
            <div className="store-section-header" style={{ borderColor: "rgba(238, 77, 45, 0.22)" }}>
              <div>
                <span className="store-section-kicker" style={{ color: "#fdba74" }}>
                  Compra Externa no Site Oficial Shopee
                </span>
                <h2 className="store-section-title">Achados Verificados</h2>
              </div>
              <Link href="/loja/produtos?tipo=shopee" className="store-section-link" style={{ color: "#fdba74" }}>
                <span>Ver todos na Shopee</span>
                <IconArrowUpRight size={14} />
              </Link>
            </div>

            <div className="store-grid">
              {shopeeRes.products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </section>
        )}
      </SmartDiscoveryShelf>

      {/* 6. Bloco Único de Engenharia de Software (Sites, APIs, Sistemas) */}
      <section className="store-engineering-cta">
        <div style={{ maxWidth: "620px" }}>
          <span className="store-section-kicker">SMKON Engineering Studio</span>
          <h2 style={{ fontSize: "22px", fontWeight: 800, color: "#fff", margin: "6px 0 8px" }}>
            Precisa de um site, loja virtual, API ou automação sob medida?
          </h2>
          <p style={{ fontSize: "13px", color: "var(--store-muted)", margin: 0, lineHeight: "1.6" }}>
            Use nosso simulador automático para calcular faixa de investimento, prazo em dias úteis e gerar uma proposta técnica na hora.
          </p>
        </div>

        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
          <Link href="/loja/orcamentos" className="store-btn store-btn-primary">
            <IconCode size={15} />
            <span>Simular Orçamento Agora</span>
          </Link>
          <Link href="/loja/rastrear" className="store-btn store-btn-secondary">
            Rastrear Pedido
          </Link>
        </div>
      </section>
    </>
  );
}
