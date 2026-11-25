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
  const [featuredRes, bestsellersRes, shopeeRes, digitalRes] = await Promise.all([
    listStoreProducts({ featured: true, limit: 8 }),
    listStoreProducts({ bestseller: true, limit: 8 }),
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

      <TrustFeatures />
    </>
  );
}
