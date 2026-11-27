import React from "react";
import Link from "next/link";
import { getStoreSettings, listStoreProducts } from "@/lib/store/repository";
import { HeroBanner } from "@/components/store/HeroBanner";
import { ProductCard } from "@/components/store/ProductCard";
import { TrustFeatures } from "@/components/store/TrustFeatures";
import {
  IconArrowUpRight,
  IconBag,
  IconCode,
  IconCpu,
  IconPackage,
  IconStar,
  IconZap,
} from "@/components/store/StoreIcons";

export const revalidate = 60;

export default async function LojaHomePage() {
  const settings = await getStoreSettings();

  const [featuredRes, bestsellersRes, newArrivalsRes, shopeeRes, digitalRes] = await Promise.all([
    listStoreProducts({ featured: true, limit: 8 }),
    listStoreProducts({ bestseller: true, limit: 8 }),
    listStoreProducts({ newArrival: true, limit: 8 }),
    listStoreProducts({ fulfillmentMode: "external_affiliate", limit: 8 }),
    listStoreProducts({ fulfillmentMode: "internal_digital", limit: 8 }),
  ]);

  const fallbackRes =
    featuredRes.products.length === 0
      ? await listStoreProducts({ limit: 8 })
      : { products: [] };

  const featuredList =
    featuredRes.products.length > 0 ? featuredRes.products : fallbackRes.products;

  return (
    <>
      <HeroBanner banners={settings.hero_banners} />

      {/* Categorias Rápidas */}
      <section style={{ marginBottom: "36px" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", justifyContent: "center" }}>
          {settings.categories_nav.map((cat) => (
            <Link
              key={cat.id}
              href={`/loja/produtos?categoria=${cat.slug}`}
              className="store-btn store-btn-secondary"
              style={{ padding: "9px 16px", fontSize: "13px", borderRadius: "999px" }}
            >
              <span>{cat.name}</span>
              {cat.badge && (
                <span
                  style={{
                    fontSize: "10px",
                    background: "rgba(212, 175, 55, 0.16)",
                    color: "var(--store-accent)",
                    border: "1px solid rgba(212, 175, 55, 0.32)",
                    padding: "2px 7px",
                    borderRadius: "999px",
                    fontWeight: 700,
                  }}
                >
                  {cat.badge}
                </span>
              )}
            </Link>
          ))}
        </div>
      </section>

      {/* Pilares Comerciais SMKON */}
      <section className="store-pillars-grid" aria-label="Canais da Loja SMKON">
        <Link href="/loja/produtos?tipo=fisico" className="store-pillar-card">
          <span className="store-pillar-tag" style={{ color: "var(--store-accent)", display: "inline-flex", alignItems: "center", gap: "6px" }}>
            <IconPackage size={14} />
            <span>Loja Própria · Envio Brasil</span>
          </span>
          <h2 className="store-pillar-title">Periféricos, Setup & Hardware</h2>
          <p className="store-pillar-desc">
            Equipamentos selecionados com estoque real, cálculo de frete na hora e rastreio completo via transportadora.
          </p>
        </Link>

        <Link href="/loja/produtos?tipo=digital" className="store-pillar-card">
          <span className="store-pillar-tag" style={{ color: "#e4e4e7", display: "inline-flex", alignItems: "center", gap: "6px" }}>
            <IconCpu size={14} />
            <span>Liberação Automática Pós-PIX</span>
          </span>
          <h2 className="store-pillar-title">Infoprodutos, Sistemas & Planilhas</h2>
          <p className="store-pillar-desc">
            Ferramentas comerciais, soluções para PDV, e-books e templates entregues na hora após confirmação.
          </p>
        </Link>

        <Link href="/loja/produtos?tipo=shopee" className="store-pillar-card">
          <span className="store-pillar-tag" style={{ color: "#fdba74", display: "inline-flex", alignItems: "center", gap: "6px" }}>
            <IconBag size={14} />
            <span>Curadoria Oficial Shopee</span>
          </span>
          <h2 className="store-pillar-title">Achados Verificados com Score</h2>
          <p className="store-pillar-desc">
            Ofertas auditadas com direcionamento transparente e seguro para o site oficial da Shopee.
          </p>
        </Link>

        <Link href="/loja/orcamentos" className="store-pillar-card">
          <span className="store-pillar-tag" style={{ color: "var(--store-accent)", display: "inline-flex", alignItems: "center", gap: "6px" }}>
            <IconCode size={14} />
            <span>Engenharia de Software</span>
          </span>
          <h2 className="store-pillar-title">Sites, APIs, Sistemas & Bots</h2>
          <p className="store-pillar-desc">
            Simulador automático de orçamento para criação de sites, e-commerces, APIs e automações sob medida.
          </p>
        </Link>
      </section>

      {/* Destaques da Semana */}
      {featuredList.length > 0 && (
        <section className="store-section">
          <div className="store-section-header">
            <h2 className="store-section-title">
              <span style={{ color: "var(--store-accent)", display: "inline-flex" }}><IconStar size={18} /></span>
              <span>Destaques Selecionados</span>
            </h2>
            <Link href="/loja/produtos?destaque=true" className="store-section-link">
              <span>Ver todos</span>
              <IconArrowUpRight size={14} />
            </Link>
          </div>
          <div className="store-grid">
            {featuredList.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </section>
      )}

      {/* Infoprodutos & Soluções Digitais */}
      {digitalRes.products.length > 0 && (
        <section
          className="store-section"
          style={{
            background: "linear-gradient(180deg, rgba(212, 175, 55, 0.06) 0%, rgba(12, 13, 18, 0.9) 100%)",
            border: "1px solid var(--store-border-strong)",
            borderRadius: "16px",
            padding: "28px",
          }}
        >
          <div className="store-section-header">
            <div>
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  color: "var(--store-accent)",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <IconZap size={12} />
                <span>Entrega Imediata após Pagamento</span>
              </span>
              <h2 className="store-section-title" style={{ marginTop: "6px" }}>
                <span>Infoprodutos, Sistemas PDV & Planilhas</span>
              </h2>
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

      {/* Mais Vendidos */}
      {bestsellersRes.products.length > 0 && (
        <section className="store-section">
          <div className="store-section-header">
            <h2 className="store-section-title">
              <span>Mais Vendidos</span>
            </h2>
            <Link href="/loja/produtos?mais_vendidos=true" className="store-section-link">
              <span>Ver mais</span>
              <IconArrowUpRight size={14} />
            </Link>
          </div>
          <div className="store-grid">
            {bestsellersRes.products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </section>
      )}

      {/* Achados da Shopee */}
      {shopeeRes.products.length > 0 && (
        <section
          className="store-section"
          style={{
            background: "linear-gradient(180deg, rgba(238, 77, 45, 0.06) 0%, transparent 100%)",
            border: "1px solid rgba(238, 77, 45, 0.25)",
            borderRadius: "16px",
            padding: "28px",
          }}
        >
          <div className="store-section-header" style={{ borderColor: "rgba(238, 77, 45, 0.2)" }}>
            <div>
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  color: "#fdba74",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                }}
              >
                Link Oficial Shopee Afiliado
              </span>
              <h2 className="store-section-title" style={{ marginTop: "4px" }}>
                <span>Curadoria Shopee Verificada</span>
              </h2>
            </div>
            <Link
              href="/loja/produtos?tipo=shopee"
              className="store-section-link"
              style={{ color: "#fdba74" }}
            >
              <span>Ver todos os achados</span>
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

      {/* Novidades */}
      {newArrivalsRes.products.length > 0 && (
        <section className="store-section">
          <div className="store-section-header">
            <h2 className="store-section-title">
              <span>Lançamentos Recentes</span>
            </h2>
            <Link href="/loja/produtos?ordem=newest" className="store-section-link">
              <span>Ver lançamentos</span>
              <IconArrowUpRight size={14} />
            </Link>
          </div>
          <div className="store-grid">
            {newArrivalsRes.products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </section>
      )}

      {/* Suporte & Rastreamento Rápido */}
      <section
        style={{
          background: "linear-gradient(135deg, rgba(212, 175, 55, 0.09), rgba(12, 13, 18, 0.96))",
          border: "1px solid var(--store-border-strong)",
          borderRadius: "18px",
          padding: "28px",
          marginBottom: "40px",
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "20px",
        }}
      >
        <div style={{ maxWidth: "600px" }}>
          <span className="store-pillar-tag" style={{ color: "var(--store-accent)" }}>
            Atendimento & Pós-Venda
          </span>
          <h2 style={{ fontSize: "22px", fontWeight: 800, color: "#fff", margin: "6px 0 8px" }}>
            Acompanhe seu pedido ou solicite um projeto sob medida
          </h2>
          <p style={{ fontSize: "13px", color: "var(--store-muted)", margin: 0, lineHeight: "1.6" }}>
            Consulte o código SMK em segundos, baixe seus infoprodutos ou simule o orçamento de um site/API com nossa equipe.
          </p>
        </div>
        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
          <Link href="/loja/rastrear" className="store-btn store-btn-primary">
            <IconPackage size={15} />
            <span>Rastrear Pedido</span>
          </Link>
          <Link href="/loja/orcamentos" className="store-btn store-btn-secondary">
            <IconCode size={15} />
            <span>Orçamento de Software</span>
          </Link>
        </div>
      </section>

      <TrustFeatures />
    </>
  );
}
