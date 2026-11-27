import React from "react";
import Link from "next/link";
import { getStoreSettings, listStoreProducts } from "@/lib/store/repository";
import { HeroBanner } from "@/components/store/HeroBanner";
import { ProductCard } from "@/components/store/ProductCard";
import { TrustFeatures } from "@/components/store/TrustFeatures";

export const revalidate = 60; // ISR 1 minuto

export default async function LojaHomePage() {
  const settings = await getStoreSettings();

  // Busca produtos em paralelo
  const [featuredRes, bestsellersRes, newArrivalsRes, shopeeRes, digitalRes] = await Promise.all([
    listStoreProducts({ featured: true, limit: 8 }),
    listStoreProducts({ bestseller: true, limit: 8 }),
    listStoreProducts({ newArrival: true, limit: 8 }),
    listStoreProducts({ fulfillmentMode: "external_affiliate", limit: 8 }),
    listStoreProducts({ fulfillmentMode: "internal_digital", limit: 8 }),
  ]);

  // Se o banco ainda não tiver produtos com flags específicas, busca os mais recentes
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
        <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", justifyContent: "center" }}>
          {settings.categories_nav.map((cat) => (
            <Link
              key={cat.id}
              href={`/loja/produtos?categoria=${cat.slug}`}
              className="store-btn store-btn-secondary"
              style={{ padding: "10px 18px", fontSize: "13px", borderRadius: "999px" }}
            >
              <span>{cat.name}</span>
              {cat.badge && (
                <span
                  style={{
                    fontSize: "10px",
                    background: "var(--store-primary)",
                    color: "#fff",
                    padding: "2px 7px",
                    borderRadius: "999px",
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
          <span className="store-pillar-tag" style={{ color: "var(--store-accent)" }}>
            📦 Loja Própria · Envio Brasil
          </span>
          <h2 className="store-pillar-title">Periféricos, Setup & Hardware</h2>
          <p className="store-pillar-desc">
            Produtos selecionados com estoque real, cálculo de frete na hora e rastreio completo via transportadora.
          </p>
        </Link>

        <Link href="/loja/produtos?tipo=digital" className="store-pillar-card">
          <span className="store-pillar-tag" style={{ color: "#c084fc" }}>
            💻 Liberação Automática Pós-PIX
          </span>
          <h2 className="store-pillar-title">Infoprodutos, Sistemas & Planilhas</h2>
          <p className="store-pillar-desc">
            Ferramentas comerciais, soluções para PDV, e-books e templates entregues na hora após confirmação.
          </p>
        </Link>

        <Link href="/loja/produtos?tipo=shopee" className="store-pillar-card">
          <span className="store-pillar-tag" style={{ color: "var(--store-shopee)" }}>
            🛍️ Curadoria Oficial Shopee
          </span>
          <h2 className="store-pillar-title">Achados Verificados com Score</h2>
          <p className="store-pillar-desc">
            Ofertas auditadas com direcionamento transparente e seguro para o site oficial da Shopee.
          </p>
        </Link>
      </section>

      {/* Destaques da Semana */}
      {featuredList.length > 0 && (
        <section className="store-section">
          <div className="store-section-header">
            <h2 className="store-section-title">
              <span>⭐</span>
              <span>Destaques Selecionados</span>
            </h2>
            <Link href="/loja/produtos?destaque=true" className="store-section-link">
              Ver todos ↗
            </Link>
          </div>
          <div className="store-grid">
            {featuredList.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </section>
      )}

      {/* Achados da Shopee — Seção Dedicada */}
      {shopeeRes.products.length > 0 && (
        <section
          className="store-section"
          style={{
            background: "linear-gradient(180deg, rgba(238, 77, 45, 0.08) 0%, transparent 100%)",
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
                  color: "var(--store-shopee)",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                }}
              >
                Link Oficial Shopee Afiliado
              </span>
              <h2 className="store-section-title" style={{ marginTop: "4px" }}>
                <span>🛍️</span>
                <span>Top Achados da Shopee Verificados</span>
              </h2>
            </div>
            <Link
              href="/loja/produtos?tipo=shopee"
              className="store-section-link"
              style={{ color: "var(--store-shopee)" }}
            >
              Ver todos os achados ↗
            </Link>
          </div>

          <div className="store-grid">
            {shopeeRes.products.map((product) => (
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
              <span>🔥</span>
              <span>Mais Vendidos</span>
            </h2>
            <Link href="/loja/produtos?mais_vendidos=true" className="store-section-link">
              Ver mais ↗
            </Link>
          </div>
          <div className="store-grid">
            {bestsellersRes.products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </section>
      )}

      {/* Infoprodutos & Soluções Digitais — Seção Dedicada */}
      {digitalRes.products.length > 0 && (
        <section
          className="store-section"
          style={{
            background: "linear-gradient(180deg, rgba(124, 58, 237, 0.08) 0%, transparent 100%)",
            border: "1px solid rgba(124, 58, 237, 0.25)",
            borderRadius: "16px",
            padding: "28px",
          }}
        >
          <div className="store-section-header" style={{ borderColor: "rgba(124, 58, 237, 0.2)" }}>
            <div>
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  color: "var(--store-secondary)",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                }}
              >
                Entrega Imediata após Pagamento
              </span>
              <h2 className="store-section-title" style={{ marginTop: "4px" }}>
                <span>💻</span>
                <span>Infoprodutos, E-books & Sistemas</span>
              </h2>
            </div>
            <Link
              href="/loja/produtos?tipo=digital"
              className="store-section-link"
              style={{ color: "var(--store-secondary)" }}
            >
              Ver soluções digitais ↗
            </Link>
          </div>

          <div className="store-grid">
            {digitalRes.products.map((product) => (
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
              <span>✨</span>
              <span>Novidades na Loja</span>
            </h2>
            <Link href="/loja/produtos?ordem=newest" className="store-section-link">
              Ver lançamentos ↗
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
          background: "linear-gradient(135deg, rgba(37, 99, 255, 0.14), rgba(17, 22, 31, 0.95))",
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
            Atendimento Inteligente & Pós-Venda
          </span>
          <h2 style={{ fontSize: "22px", fontWeight: 800, color: "#fff", margin: "6px 0 8px" }}>
            Precisa acompanhar um pedido ou tirar dúvidas antes de comprar?
          </h2>
          <p style={{ fontSize: "13px", color: "var(--store-muted)", margin: 0, lineHeight: "1.6" }}>
            Consulte seu código SMK em segundos ou clique no botão <strong>Suporte SMKON</strong> no canto inferior direito para falar com nosso assistente 24h.
          </p>
        </div>
        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
          <Link href="/loja/rastrear" className="store-btn store-btn-primary">
            📦 Rastrear Pedido
          </Link>
          <Link href="/loja/produtos" className="store-btn store-btn-secondary">
            Explorar Catálogo
          </Link>
        </div>
      </section>

      <TrustFeatures />
    </>
  );
}
