import React from "react";
import Link from "next/link";
import { listStoreProducts, getStoreSettings } from "@/lib/store/repository";
import { ProductCard } from "@/components/store/ProductCard";
import { CatalogSortSelect } from "@/components/store/CatalogSortSelect";

export const metadata = {
  title: "Catálogo de Produtos | SMKON Loja Oficial",
  description: "Explore periféricos, achados Shopee, tecnologia e infoprodutos testados e validados.",
};

type Props = {
  searchParams: Promise<{
    categoria?: string;
    q?: string;
    tipo?: string;
    destaque?: string;
    mais_vendidos?: string;
    ordem?: "price_asc" | "price_desc" | "newest" | "score";
  }>;
};

export default async function StoreProductsPage({ searchParams }: Props) {
  const params = await searchParams;
  const settings = await getStoreSettings();

  const category = params.categoria || undefined;
  const search = params.q || undefined;
  const tipo = params.tipo || undefined;
  const featured = params.destaque === "true";
  const bestseller = params.mais_vendidos === "true";
  const sort = params.ordem || "newest";

  const fulfillmentMode =
    tipo === "digital"
      ? "internal_digital"
      : tipo === "shopee" || tipo === "afiliado"
      ? "external_affiliate"
      : tipo === "fisico"
      ? "internal_physical"
      : undefined;

  const { products, total } = await listStoreProducts({
    category,
    search,
    fulfillmentMode,
    featured,
    bestseller,
    sort,
    limit: 48,
  });

  return (
    <div>
      {/* Header do Catálogo */}
      <div style={{ marginBottom: "28px" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: "12px", flexWrap: "wrap" }}>
          <h1 style={{ fontSize: "28px", fontWeight: "800", color: "#fff" }}>
            {category ? `Categoria: ${category}` : search ? `Busca: "${search}"` : "Catálogo de Produtos"}
          </h1>
          <span style={{ color: "var(--store-muted)", fontSize: "14px" }}>
            ({total} {total === 1 ? "produto encontrado" : "produtos encontrados"})
          </span>
        </div>
      </div>

      {/* Barra de Filtros Rápidos */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "16px",
          background: "var(--store-surface)",
          border: "1px solid var(--store-border)",
          borderRadius: "12px",
          padding: "14px 18px",
          marginBottom: "32px",
        }}
      >
        {/* Tipos */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
          <Link
            href="/loja/produtos"
            className={`store-btn ${!tipo ? "store-btn-primary" : "store-btn-secondary"}`}
            style={{ padding: "6px 12px", fontSize: "12px", borderRadius: "999px" }}
          >
            Todos
          </Link>
          <Link
            href="/loja/produtos?tipo=shopee"
            className={`store-btn ${tipo === "shopee" ? "store-btn-shopee" : "store-btn-secondary"}`}
            style={{ padding: "6px 12px", fontSize: "12px", borderRadius: "999px" }}
          >
            🛍️ Achados Shopee
          </Link>
          <Link
            href="/loja/produtos?tipo=digital"
            className={`store-btn ${tipo === "digital" ? "store-btn-primary" : "store-btn-secondary"}`}
            style={{ padding: "6px 12px", fontSize: "12px", borderRadius: "999px" }}
          >
            💻 Infoprodutos
          </Link>
          <Link
            href="/loja/produtos?tipo=fisico"
            className={`store-btn ${tipo === "fisico" ? "store-btn-primary" : "store-btn-secondary"}`}
            style={{ padding: "6px 12px", fontSize: "12px", borderRadius: "999px" }}
          >
            📦 Físicos
          </Link>
        </div>

        {/* Categorias Pills + Ordenação */}
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "12px" }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
            {settings.categories_nav.map((cat) => (
              <Link
                key={cat.id}
                href={`/loja/produtos?categoria=${cat.slug}`}
                style={{
                  fontSize: "12px",
                  color: category === cat.slug ? "var(--store-accent)" : "var(--store-muted)",
                  textDecoration: "none",
                  padding: "4px 8px",
                  borderRadius: "6px",
                  background: category === cat.slug ? "rgba(0, 240, 255, 0.1)" : "transparent",
                }}
              >
                {cat.name}
              </Link>
            ))}
          </div>
          <CatalogSortSelect currentSort={sort} />
        </div>
      </div>

      {/* Grid de Produtos */}
      {products.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "80px 20px",
            background: "var(--store-surface)",
            borderRadius: "16px",
            border: "1px solid var(--store-border)",
          }}
        >
          <span style={{ fontSize: "44px" }}>🔍</span>
          <h3 style={{ fontSize: "18px", color: "#fff", marginTop: "16px", marginBottom: "8px" }}>
            Nenhum produto encontrado
          </h3>
          <p style={{ color: "var(--store-muted)", fontSize: "14px", maxWidth: "440px", margin: "0 auto 24px" }}>
            Tente buscar com outros termos ou selecione uma categoria diferente.
          </p>
          <Link href="/loja/produtos" className="store-btn store-btn-primary">
            Ver Todos os Produtos
          </Link>
        </div>
      ) : (
        <div className="store-grid">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  );
}
