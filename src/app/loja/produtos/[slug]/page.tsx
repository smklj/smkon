import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getStoreProductBySlug } from "@/lib/store/repository";
import { ProductCard } from "@/components/store/ProductCard";
import { ProductDetailActions } from "./ProductDetailActions";
import { ProductGallery } from "@/components/store/ProductGallery";

function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const { product } = await getStoreProductBySlug(slug);

  if (!product) return { title: "Produto não encontrado | SMKON" };

  return {
    title: `${product.name} | SMKON Loja Oficial`,
    description: product.short_description || product.description?.slice(0, 160) || "Detalhes do produto.",
  };
}

export default async function ProductDetailPage({ params }: Props) {
  const { slug } = await params;
  const { product, related } = await getStoreProductBySlug(slug);

  if (!product) {
    notFound();
  }

  const isShopee = product.fulfillment_mode === "external_affiliate";
  const isDigital = product.fulfillment_mode === "internal_digital";
  const mainImage = product.image_urls[0] || "/brand/brand-identity-board.jpg";

  return (
    <div>
      {/* Breadcrumbs */}
      <nav style={{ marginBottom: "20px", fontSize: "12px", color: "var(--store-muted)" }}>
        <Link href="/loja" style={{ color: "var(--store-muted)" }}>Início</Link>
        <span style={{ margin: "0 8px" }}>/</span>
        <Link href="/loja/produtos" style={{ color: "var(--store-muted)" }}>Produtos</Link>
        <span style={{ margin: "0 8px" }}>/</span>
        <Link href={`/loja/produtos?categoria=${encodeURIComponent(product.category)}`} style={{ color: "var(--store-muted)" }}>
          {product.category}
        </Link>
        <span style={{ margin: "0 8px" }}>/</span>
        <span style={{ color: "#fff" }}>{product.name}</span>
      </nav>

      {/* Main product presentation */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: "40px",
          background: "var(--store-surface)",
          border: "1px solid var(--store-border)",
          borderRadius: "18px",
          padding: "32px",
          marginBottom: "48px",
        }}
      >
        {/* Gallery */}
        <ProductGallery images={product.image_urls} productName={product.name} />

        {/* Product Details */}
        <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
              <span style={{ fontSize: "12px", color: "var(--store-muted)", textTransform: "uppercase" }}>
                {product.category}
              </span>
              {isShopee && (
                <span className="store-badge-shopee" style={{ fontSize: "11px", padding: "2px 8px", borderRadius: "4px" }}>
                  Shopee Oficial
                </span>
              )}
              {isDigital && (
                <span className="store-badge-digital" style={{ fontSize: "11px", padding: "2px 8px", borderRadius: "4px" }}>
                  Infoproduto Digital
                </span>
              )}
              {product.score !== null && (
                <span className="store-badge-score" style={{ position: "static" }}>
                  ★ Score SMKON: {product.score.toFixed(1)}
                </span>
              )}
            </div>

            <h1 style={{ fontSize: "26px", fontWeight: "800", color: "#fff", lineHeight: "1.3" }}>
              {product.name}
            </h1>

            {product.sku && (
              <span style={{ fontSize: "12px", color: "var(--store-muted)" }}>
                SKU: {product.sku}
              </span>
            )}
          </div>

          {/* Preço */}
          <div
            style={{
              padding: "16px 20px",
              background: "#0d131d",
              borderRadius: "10px",
              border: "1px solid var(--store-border)",
            }}
          >
            {product.compare_at_price_cents && product.compare_at_price_cents > product.price_cents && (
              <div style={{ fontSize: "13px", color: "var(--store-muted)", textDecoration: "line-through" }}>
                De {formatBRL(product.compare_at_price_cents)}
              </div>
            )}
            <div style={{ fontSize: "30px", fontWeight: "800", color: "var(--store-accent)" }}>
              {formatBRL(product.price_cents)}
            </div>
            <div style={{ fontSize: "12px", color: "var(--store-muted)", marginTop: "4px" }}>
              Em até 12x no cartão ou com desconto no PIX instantâneo
            </div>
          </div>

          {/* Indicador de Estoque */}
          {!isShopee && (
            <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px" }}>
              <span style={{ color: product.stock_quantity > 0 || !product.track_inventory ? "var(--store-success)" : "#ef4444" }}>
                ●
              </span>
              <span>
                {product.track_inventory
                  ? product.stock_quantity > 0
                    ? `Disponível em estoque (${product.stock_quantity} unidades)`
                    : "Produto temporariamente esgotado"
                  : "Disponível para envio imediato"}
              </span>
            </div>
          )}

          {/* Shopee Notice or Action */}
          {isShopee ? (
            <div
              style={{
                background: "rgba(238, 77, 45, 0.08)",
                border: "1px solid rgba(238, 77, 45, 0.3)",
                borderRadius: "12px",
                padding: "18px",
                display: "flex",
                flexDirection: "column",
                gap: "12px",
              }}
            >
              <div style={{ fontSize: "13px", color: "#fed7aa", lineHeight: "1.5" }}>
                <strong>Produto parceiro verificado:</strong> Este item é vendido e enviado diretamente por vendedores oficiais na Shopee com garantia e proteção ao consumidor.
              </div>
              <a
                href={product.affiliate_url || "#"}
                target="_blank"
                rel="noopener noreferrer"
                className="store-btn store-btn-shopee"
                style={{ padding: "14px", fontSize: "15px" }}
              >
                Comprar com Desconto na Shopee ↗
              </a>
            </div>
          ) : (
            <ProductDetailActions product={product} />
          )}

          {/* Benefícios se for Digital */}
          {isDigital && product.digital_benefits.length > 0 && (
            <div
              style={{
                background: "rgba(124, 58, 237, 0.08)",
                border: "1px solid rgba(124, 58, 237, 0.3)",
                borderRadius: "12px",
                padding: "16px",
              }}
            >
              <h4 style={{ fontSize: "13px", fontWeight: "700", color: "#c084fc", marginBottom: "8px" }}>
                ✨ O que está incluso nesta solução digital:
              </h4>
              <ul style={{ paddingLeft: "20px", margin: 0, fontSize: "13px", color: "#e2e8f0" }}>
                {product.digital_benefits.map((b, idx) => (
                  <li key={idx} style={{ marginBottom: "4px" }}>{b}</li>
                ))}
              </ul>
              <div style={{ marginTop: "10px", fontSize: "12px", color: "var(--store-muted)" }}>
                ⚡ Acesso liberado automaticamente por e-mail e na tela após confirmação do pagamento.
              </div>
            </div>
          )}

          {/* Descrição */}
          <div style={{ marginTop: "12px" }}>
            <h3 style={{ fontSize: "16px", fontWeight: "700", color: "#fff", marginBottom: "8px" }}>
              Descrição do Produto
            </h3>
            <div
              style={{
                fontSize: "14px",
                color: "var(--store-muted)",
                lineHeight: "1.7",
                whiteSpace: "pre-line",
              }}
            >
              {product.description || product.short_description || "Sem descrição detalhada cadastrada."}
            </div>
          </div>
        </div>
      </div>

      {/* Produtos Relacionados */}
      {related.length > 0 && (
        <section className="store-section">
          <div className="store-section-header">
            <h2 className="store-section-title">Produtos Relacionados</h2>
          </div>
          <div className="store-grid">
            {related.map((rel) => (
              <ProductCard key={rel.id} product={rel} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
