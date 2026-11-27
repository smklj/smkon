import { NextResponse, type NextRequest } from "next/server";
import { getStoreOrderByCode, getStoreSettings, listStoreProducts } from "@/lib/store/repository";

type SupportRequestBody = {
  message?: string;
};

function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function buildRuleBasedReply(
  text: string,
  opts: {
    storeName: string;
    whatsapp: string | null;
    email: string | null;
    productMatches: Array<{ name: string; price_cents: number; fulfillment_mode: string; slug: string }>;
  },
): { reply: string; suggestions: string[]; links?: Array<{ label: string; href: string }> } {
  const q = text.toLowerCase();

  if (q.includes("digital") || q.includes("infoproduto") || q.includes("ebook") || q.includes("sistema") || q.includes("planilha")) {
    return {
      reply:
        "Nossos infoprodutos, planilhas e sistemas digitais têm liberação automática assim que o pagamento (PIX ou cartão) é confirmado. O link seguro e as instruções aparecem na página do seu pedido e também podem ser acessados a qualquer momento pelo código SMK.",
      suggestions: ["Ver infoprodutos", "Formas de pagamento", "Falar com suporte"],
      links: [{ label: "Explorar Infoprodutos & Digitais", href: "/loja/produtos?tipo=digital" }],
    };
  }

  if (q.includes("shopee") || q.includes("afiliado") || q.includes("achado")) {
    return {
      reply:
        "Os itens marcados como 'Shopee Oficial' são achados selecionados pela curadoria SMKON. Ao clicar em 'Comprar na Shopee', você é direcionado com segurança para finalizar a compra diretamente no site/app oficial da Shopee.",
      suggestions: ["Ver achados Shopee", "Produtos próprios SMKON"],
      links: [{ label: "Ver Achados da Shopee", href: "/loja/produtos?tipo=shopee" }],
    };
  }

  if (q.includes("frete") || q.includes("envio") || q.includes("prazo") || q.includes("entrega") || q.includes("correio")) {
    return {
      reply:
        "Para produtos físicos próprios, você pode calcular o frete e o prazo exato informando seu CEP no carrinho ou no checkout (integramos com Correios e transportadoras via Melhor Envio). Já os infoprodutos digitais têm frete grátis e entrega imediata!",
      suggestions: ["Ir para o carrinho", "Rastrear meu pedido"],
      links: [{ label: "Abrir Carrinho", href: "/loja/carrinho" }],
    };
  }

  if (q.includes("pix") || q.includes("pagamento") || q.includes("cart") || q.includes("parcel") || q.includes("boleto")) {
    return {
      reply:
        "Aceitamos PIX com aprovação instantânea (QR Code e Copia e Cola) e Cartão de Crédito via Mercado Pago. Assim que o pagamento é aprovado, seu pedido avança automaticamente.",
      suggestions: ["Como funciona a entrega digital?", "Prazo e frete"],
    };
  }

  if (q.includes("rastrear") || q.includes("rastreio") || q.includes("pedido") || q.includes("acompanhar")) {
    return {
      reply:
        "Para acompanhar um pedido ou acessar seus downloads digitais, basta me enviar aqui o código do seu pedido (ex: SMK-261125-1234) ou abrir o link recebido na confirmação da compra.",
      suggestions: ["Formas de pagamento", "Falar com atendimento humano"],
    };
  }

  if (q.includes("humano") || q.includes("whatsapp") || q.includes("atendente") || q.includes("suporte") || q.includes("ajuda")) {
    const contactParts = [];
    if (opts.whatsapp) contactParts.push(`WhatsApp: ${opts.whatsapp}`);
    if (opts.email) contactParts.push(`E-mail: ${opts.email}`);
    const contactText = contactParts.length > 0 ? contactParts.join(" · ") : "nosso canal oficial no rodapé da loja";

    return {
      reply: `Claro! Se precisar de atendimento humano para um pedido específico, você pode falar com a equipe ${opts.storeName} através de ${contactText}.`,
      suggestions: ["Rastrear meu pedido", "Ver catálogo completo"],
      links: [{ label: "Ver Produtos", href: "/loja/produtos" }],
    };
  }

  if (opts.productMatches.length > 0) {
    const summary = opts.productMatches
      .slice(0, 3)
      .map((p) => `• ${p.name} (${formatBRL(p.price_cents)})`)
      .join("\n");
    return {
      reply: `Encontrei estes itens no catálogo relacionados à sua dúvida:\n${summary}\n\nClique em qualquer link abaixo para ver detalhes completos.`,
      suggestions: ["Formas de pagamento", "Prazo e frete"],
      links: opts.productMatches.slice(0, 3).map((p) => ({
        label: p.name,
        href: `/loja/produtos/${p.slug}`,
      })),
    };
  }

  return {
    reply: `Olá! Sou o assistente virtual da ${opts.storeName}. Posso te ajudar com produtos físicos, infoprodutos e digitais, achados da Shopee, cálculo de frete, pagamento via PIX/cartão ou status do seu pedido (basta enviar o código SMK-...).`,
    suggestions: [
      "Como funciona a entrega digital?",
      "Prazo e frete",
      "Produtos da Shopee",
      "Rastrear meu pedido",
    ],
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as SupportRequestBody;
    const message = String(body.message || "").trim();

    if (!message || message.length > 500) {
      return NextResponse.json(
        { error: "Envie uma mensagem válida de até 500 caracteres." },
        { status: 400 },
      );
    }

    const settings = await getStoreSettings();

    // 1. Verifica se o cliente enviou um código de pedido (ex: SMK-261125-1234)
    const orderMatch = message.toUpperCase().match(/\bSMK-[A-Z0-9-]{4,20}\b/);
    if (orderMatch) {
      const orderCode = orderMatch[0];
      const order = await getStoreOrderByCode(orderCode);
      if (order) {
        const paymentLabel = order.payment_status === "approved" ? "Aprovado" : "Pendente";
        const trackingText = order.tracking_code
          ? `Código de rastreio: ${order.tracking_code}.`
          : "Ainda sem código de rastreio lançado.";
        return NextResponse.json({
          reply: `Pedido ${order.order_code} localizado!\n• Status: ${order.status}\n• Pagamento: ${paymentLabel}\n• Total: ${formatBRL(order.total_amount_cents)}\n• ${trackingText}`,
          suggestions: ["Ver página do pedido", "Falar com suporte"],
          links: [{ label: `Abrir pedido ${order.order_code}`, href: `/loja/pedido/${order.order_code}` }],
        });
      }

      return NextResponse.json({
        reply: `Não encontrei nenhum pedido com o código ${orderCode}. Confira se o código está correto ou fale com nossa equipe de atendimento.`,
        suggestions: ["Falar com atendimento humano", "Ver catálogo"],
      });
    }

    // 2. Busca produtos relevantes caso o usuário mencione algum termo
    const searchKeywords = message
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/)
      .filter((w) => w.length >= 4)
      .slice(0, 2);

    let productMatches: Array<{ name: string; price_cents: number; fulfillment_mode: string; slug: string }> = [];
    if (searchKeywords.length > 0) {
      const res = await listStoreProducts({ search: searchKeywords[0], limit: 3 });
      productMatches = res.products;
    }

    const response = buildRuleBasedReply(message, {
      storeName: settings.store_name,
      whatsapp: settings.support_whatsapp,
      email: settings.support_email,
      productMatches,
    });

    return NextResponse.json(response);
  } catch {
    return NextResponse.json(
      {
        reply: "Tive uma instabilidade momentânea, mas você pode navegar pelo catálogo ou tentar novamente em alguns segundos.",
        suggestions: ["Ver produtos", "Infoprodutos"],
      },
      { status: 200 },
    );
  }
}
