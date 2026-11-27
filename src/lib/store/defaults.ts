import type { StoreSettings } from "./types";

export function getDefaultStoreSettings(organizationId: string = "default"): StoreSettings {
  return {
    id: "default-settings",
    organization_id: organizationId,
    store_name: "SMKON Loja Oficial",
    store_tagline: "Achados inteligentes. Escolhas melhores.",
    logo_url: "/brand/smkon-logo-horizontal-white.svg",
    hero_banners: [
      {
        id: "banner-hero-1",
        title: "Hardware, Sistemas & Engenharia de Alto Padrão",
        subtitle: "Periféricos de estúdio, soluções digitais de liberação imediata e curadoria verificada com garantia SMKON.",
        badge_text: "COLEÇÃO BLACK & GOLD",
        cta_text: "Explorar Catálogo",
        cta_href: "/loja/produtos",
        image_url: "/brand/hero-luxury-gold.jpg",
        active: true,
      },
      {
        id: "banner-hero-2",
        title: "Top Achados Shopee Verificados",
        subtitle: "Curadoria técnica com direcionamento transparente para o site oficial da Shopee.",
        badge_text: "SHOPEE SELECTION",
        cta_text: "Ver Achados Shopee",
        cta_href: "/loja/produtos?tipo=shopee",
        image_url: "/brand/demo-keyboard.jpg",
        active: true,
      },
      {
        id: "banner-hero-3",
        title: "Infoprodutos & Soluções Comerciais",
        subtitle: "Sistemas PDV, planilhas financeiras e automações prontas com entrega automática pós-PIX.",
        badge_text: "ENTREGA DIGITAL IMEDIATA",
        cta_text: "Conhecer Soluções",
        cta_href: "/loja/produtos?tipo=digital",
        image_url: "/brand/demo-pdv.jpg",
        active: true,
      },
    ],
    announcement_bar: {
      enabled: true,
      text: "Envio rápido para todo o Brasil  |  PIX com aprovação instantânea  |  Curadoria e garantia SMKON",
      link: "/loja/produtos",
    },
    categories_nav: [
      { id: "cat-1", name: "Achados Shopee", slug: "achados", icon: "shopee", badge: "Hot", description: "Links oficiais recomendados" },
      { id: "cat-2", name: "Tecnologia & Setup", slug: "tecnologia", icon: "tech", description: "Periféricos e acessórios gamer" },
      { id: "cat-3", name: "Reviews Aprovados", slug: "reviews", icon: "review", description: "Testados e recomendados" },
      { id: "cat-4", name: "Infoprodutos & E-books", slug: "infoprodutos", icon: "digital", badge: "Imediato", description: "Sistemas, planilhas e guias" },
      { id: "cat-5", name: "Utilidades & Casa", slug: "utilidades", icon: "gadgets", description: "Praticidade para o dia a dia" },
    ],
    primary_color: "#2563FF",
    accent_color: "#00F0FF",
    support_email: "suporte@smkon.com.br",
    support_whatsapp: "5511999999999",
    social_links: {
      instagram: "https://instagram.com/smkonoficial",
      tiktok: "https://tiktok.com/@smkonoficial",
      youtube: "https://youtube.com/@smkonoficial",
      shopee: "https://shopee.com.br",
    },
    shipping_origin_cep: "01001000",
    free_shipping_min_cents: 24900, // Frete grátis acima de R$ 249,00
    is_store_active: true,
    updated_at: new Date().toISOString(),
  };
}
