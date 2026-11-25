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
        title: "Achados Inteligentes, Escolhas Melhores",
        subtitle: "Periféricos, tecnologia testada e soluções exclusivas selecionadas e validadas pela equipe SMKON.",
        badge_text: "OFERTAS DA SEMANA",
        cta_text: "Explorar Catálogo",
        cta_href: "/loja/produtos",
        image_url: "/brand/brand-identity-board.jpg",
        active: true,
      },
      {
        id: "banner-hero-2",
        title: "Top 5 Achados Shopee Verificados",
        subtitle: "Compre direto com link oficial validado pelo mascote SMKON, sem surpresas nem taxa extra.",
        badge_text: "SHOPEE SELECTION",
        cta_text: "Ver Achados Shopee",
        cta_href: "/loja/produtos?categoria=achados",
        image_url: "/brand/mascote-hero.jpg",
        active: true,
      },
      {
        id: "banner-hero-3",
        title: "Infoprodutos & Soluções Comerciais",
        subtitle: "Planilhas, sistemas, ferramentas de automação e templates para turbinar sua operação.",
        badge_text: "ENTREGA DIGITAL IMEDIATA",
        cta_text: "Conhecer Soluções",
        cta_href: "/loja/produtos?tipo=digital",
        image_url: "/brand/mascote-poses.jpg",
        active: true,
      },
    ],
    announcement_bar: {
      enabled: true,
      text: "⚡ Envio rápido para todo o Brasil | PIX com aprovação instantânea | Produtos testados e aprovados",
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
