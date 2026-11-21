/**
 * Fábrica Autônoma de Infoprodutos Digitais (Frente E · S25)
 * Gera catálogos de blueprints acionáveis e compilação em HTML/PDF de alta qualidade para venda direta.
 */

import type { InfoproductBlueprint, InfoproductNiche } from "./types.ts";

export const INFOPRODUCT_BLUEPRINTS: InfoproductBlueprint[] = [
  {
    id: "blue_achadinhos_virais",
    niche: "ecommerce-afiliados",
    title: "Manual dos Achadinhos Virais",
    subtitle: "O Método Passo a Passo para Gerar R$ 5.000/Mês com Vídeos de 15 Segundos sem Precisar Aparecer",
    authorOrBrand: "SMKON · Conteúdo & Crescimento",
    targetAudience: "Afiliados iniciantes e criadores que desejam monetizar redes sociais rapidamente",
    recommendedPriceBrl: 29.90,
    pricingTier: "impulse",
    salesCopySummary: "Descubra como minerar os produtos mais lucrativos da Shopee e Mercado Livre, editar vídeos magnéticos com legendas karaokê e criar um funil de cliques no piloto automático.",
    checkoutCta: "Quero Baixar o Manual Agora por R$ 29,90 ⚡",
    bonusPromptsOrTemplates: [
      "Prompt para IA gerar 30 ganchos virais de curiosidade em 2 minutos",
      "Checklist de postagem nos melhores horários do algoritmo",
      "Script pronto para o primeiro comentário fixado com link rastreado",
    ],
    chapters: [
      {
        number: 1,
        title: "A Mineração dos Produtos 10x de Comissão",
        hookSummary: "Por que 80% dos afiliados falham ao escolher produtos sem margem ou sem apelo visual imediato.",
        contentParagraphs: [
          "Para ter sucesso como afiliado digital ou de produtos físicos, o segredo nunca foi tentar vender qualquer coisa. O algoritmo das redes sociais favorece o que é visualmente impactante nos primeiros dois segundos de exibição.",
          "Neste capítulo, você aprenderá a filtrar produtos na Shopee e no Mercado Livre que oferecem entre 12% e 20% de comissão líquida e que resolvem um problema cotidiano evidente de forma curiosa ou satisfatória.",
        ],
        actionChecklist: [
          "Instalar a extensão de rastreamento de comissões de afiliados.",
          "Selecionar 5 produtos da categoria 'Utilidades Criativas' ou 'Beleza e Auto-cuidado'.",
          "Garantir que a oferta possui no mínimo 100 avaliações com fotos e nota acima de 4.7.",
        ],
        proTip: "Produtos com preço final entre R$ 25 e R$ 79 têm a menor barreira de resistência para compra por impulso em smartphones.",
      },
      {
        number: 2,
        title: "A Anatomia do Gancho Perfeito (0–3 Segundos)",
        hookSummary: "A retenção é a única métrica que decide se seu vídeo terá 500 visualizações ou 500 mil.",
        contentParagraphs: [
          "Se o espectador não for interrompido nos primeiros 3 segundos, ele simplesmente deslizará o dedo para o próximo vídeo. Seu papel não é apresentar o produto formalmente, mas sim quebrar um padrão de pensamento.",
          "Ganchos baseados em segredo ('O que eles não querem que você saiba...'), alerta ('Pare de comprar X antes de ver isso...') e comparação de preço ('Paguei R$ 30 no que parece de R$ 300') geram os picos de retenção mais altos do mercado.",
        ],
        actionChecklist: [
          "Escrever 3 variações de gancho para o mesmo produto.",
          "Inserir o badge visual de alerta em amarelo ou verde neon nos primeiros 2 segundos.",
          "Sincronizar o áudio com o movimento inicial do produto.",
        ],
        proTip: "Nunca inicie um vídeo dizendo 'Olá pessoal, tudo bem?'. Comece direto na ação ou na quebra de expectativa.",
      },
      {
        number: 3,
        title: "O Funil de Conversão do Comentário e Bio",
        hookSummary: "Como transformar visualizações curiosas em cliques reais no seu link de comissionamento.",
        contentParagraphs: [
          "Visualizações sem tráfego direcionado não pagam contas. A chave é orientar o espectador de forma simples e repetida sobre exatamente onde encontrar o produto.",
          "O método da palavra-chave nos comentários ('Comente EU QUERO que te envio o link exclusivo com cupom') explora o algoritmo de engajamento da plataforma e entrega a mensagem diretamente no direct do seguidor.",
        ],
        actionChecklist: [
          "Fixar o comentário com o link encurtado e o cupom de desconto em destaque.",
          "Atualizar a bio com o agregador de links oficial do SMKON.",
          "Verificar se o cookie de atribuição está configurado para a janela máxima permitida.",
        ],
        proTip: "Sempre destaque a economia imediata (ex: 'Cupom de 15% OFF + Frete Grátis disponível hoje').",
      },
    ],
  },
  {
    id: "blue_shein_hacks",
    niche: "shein-moda",
    title: "O Código Secreto da SHEIN",
    subtitle: "Como Montar Guarda-Roupas de Luxo Pagando Menos de R$ 40 por Peça e Acumular Cupons Cumulativos",
    authorOrBrand: "SMKON · Guia de Estilo & Economia",
    targetAudience: "Consumidoras inteligentes e criadoras de conteúdo de moda e achadinhos",
    recommendedPriceBrl: 24.90,
    pricingTier: "impulse",
    salesCopySummary: "Aprenda a encontrar as melhores peças ocultas na Shein, combinar cupons de até 30% com pontos diários e evitar surpresas de qualidade ou medidas erradas.",
    checkoutCta: "Garantir Meu Guia Shein com Todos os Códigos por R$ 24,90 ✨",
    chapters: [
      {
        number: 1,
        title: "O Algoritmo de Busca Oculta da Shein",
        hookSummary: "Os melhores tecidos e cortes raramente aparecem na página inicial popular.",
        contentParagraphs: [
          "A Shein cataloga dezenas de milhares de novos itens todos os meses. As peças com acabamento de alfaiataria e tecidos nobres ficam escondidas atrás de palavras-chave técnicas de busca.",
          "Ao utilizar termos específicos de modelagem em inglês e filtros avançados de composição de tecido (ex: modal, viscose densa, linho misto), você encontra peças idênticas a grifes renomadas por uma fração do preço.",
        ],
        actionChecklist: [
          "Utilizar os filtros avançados por composição têxtil e densidade de gramatura.",
          "Buscar pelas referências numéricas diretas dos fornecedores das marcas premium.",
          "Verificar as fotos reais enviadas por usuárias com medidas semelhantes às suas.",
        ],
      },
    ],
  },
];

export function getBlueprintByNiche(niche: InfoproductNiche): InfoproductBlueprint {
  return INFOPRODUCT_BLUEPRINTS.find((b) => b.niche === niche) || INFOPRODUCT_BLUEPRINTS[0];
}

/**
 * Compila o infoproduto em um documento HTML autossuficiente e formatado para impressão/leitura.
 */
export function compileInfoproductToHtml(blueprint: InfoproductBlueprint): string {
  const chaptersHtml = blueprint.chapters
    .map(
      (c) => `
    <article class="infoproduct-chapter">
      <header class="chapter-header">
        <span class="chapter-num">CAPÍTULO 0${c.number}</span>
        <h2 class="chapter-title">${c.title}</h2>
        <p class="chapter-hook">${c.hookSummary}</p>
      </header>

      <div class="chapter-body">
        ${c.contentParagraphs.map((p) => `<p>${p}</p>`).join("\n")}
      </div>

      ${
        c.actionChecklist.length > 0
          ? `
      <div class="chapter-checklist">
        <h3>📋 Checklist Prático de Aplicação</h3>
        <ul>
          ${c.actionChecklist.map((item) => `<li><span class="box">☐</span> ${item}</li>`).join("\n")}
        </ul>
      </div>
      `
          : ""
      }

      ${
        c.proTip
          ? `
      <div class="chapter-protip">
        <strong>💡 Dica de Ouro:</strong>
        <p>${c.proTip}</p>
      </div>
      `
          : ""
      }
    </article>
  `
    )
    .join("\n<hr class=\"page-break\" />\n");

  const bonusesHtml = blueprint.bonusPromptsOrTemplates
    ? `
    <section class="infoproduct-bonuses">
      <h2>🎁 Recursos & Prompts Bônus Inclusos</h2>
      <ul>
        ${blueprint.bonusPromptsOrTemplates.map((b) => `<li>⚡ ${b}</li>`).join("\n")}
      </ul>
    </section>
  `
    : "";

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>${blueprint.title} — ${blueprint.authorOrBrand}</title>
  <style>
    @page { margin: 25mm 20mm; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      line-height: 1.65;
      color: #18181b;
      background: #fafafa;
      margin: 0;
      padding: 32px 16px;
    }
    .infoproduct-container {
      max-width: 780px;
      margin: 0 auto;
      background: #ffffff;
      padding: 48px;
      border: 1px solid #e4e4e7;
      border-radius: 8px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.05);
    }
    .cover-page {
      text-align: center;
      padding: 60px 20px 40px;
      border-bottom: 2px solid #f59e0b;
      margin-bottom: 40px;
    }
    .cover-brand {
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 0.15em;
      color: #f59e0b;
      text-transform: uppercase;
      margin-bottom: 16px;
    }
    .cover-title {
      font-size: 32px;
      font-weight: 900;
      line-height: 1.2;
      color: #09090b;
      margin: 0 0 16px;
    }
    .cover-subtitle {
      font-size: 16px;
      color: #71717a;
      max-width: 600px;
      margin: 0 auto 24px;
    }
    .cover-price-badge {
      display: inline-block;
      background: #fef3c7;
      color: #b45309;
      font-size: 13px;
      font-weight: 700;
      padding: 6px 16px;
      border-radius: 9999px;
      border: 1px solid #fde68a;
    }
    .chapter-header {
      margin-top: 32px;
      margin-bottom: 20px;
    }
    .chapter-num {
      font-size: 11px;
      font-weight: 800;
      color: #f59e0b;
      letter-spacing: 0.1em;
      text-transform: uppercase;
    }
    .chapter-title {
      font-size: 24px;
      font-weight: 800;
      color: #18181b;
      margin: 4px 0 8px;
    }
    .chapter-hook {
      font-size: 14px;
      font-style: italic;
      color: #71717a;
      margin: 0;
    }
    .chapter-body p {
      font-size: 15px;
      margin-bottom: 16px;
      color: #27272a;
    }
    .chapter-checklist {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-left: 4px solid #3b82f6;
      border-radius: 6px;
      padding: 16px 20px;
      margin: 24px 0;
    }
    .chapter-checklist h3 {
      font-size: 14px;
      font-weight: 700;
      margin: 0 0 12px;
      color: #1e293b;
    }
    .chapter-checklist ul {
      list-style: none;
      padding: 0;
      margin: 0;
    }
    .chapter-checklist li {
      font-size: 13px;
      margin-bottom: 8px;
      color: #334155;
    }
    .chapter-checklist .box {
      color: #94a3b8;
      margin-right: 6px;
    }
    .chapter-protip {
      background: #fefce8;
      border: 1px solid #fef08a;
      border-left: 4px solid #eab308;
      border-radius: 6px;
      padding: 14px 18px;
      margin: 20px 0;
    }
    .chapter-protip strong {
      font-size: 13px;
      color: #a16207;
      display: block;
      margin-bottom: 4px;
    }
    .chapter-protip p {
      font-size: 13px;
      margin: 0;
      color: #713f12;
    }
    .infoproduct-bonuses {
      margin-top: 40px;
      padding-top: 24px;
      border-top: 1px solid #e4e4e7;
    }
    .infoproduct-bonuses h2 {
      font-size: 18px;
      color: #18181b;
    }
    .infoproduct-bonuses ul {
      list-style: none;
      padding: 0;
    }
    .infoproduct-bonuses li {
      font-size: 14px;
      padding: 6px 0;
      color: #3f3f46;
    }
    .footer-notice {
      margin-top: 48px;
      padding-top: 20px;
      border-top: 1px solid #e4e4e7;
      font-size: 11px;
      color: #a1a1aa;
      text-align: center;
    }
    @media print {
      body { background: #fff; padding: 0; }
      .infoproduct-container { border: 0; box-shadow: none; padding: 0; }
      .page-break { page-break-after: always; border: 0; }
    }
  </style>
</head>
<body>
  <div class="infoproduct-container">
    <header class="cover-page">
      <div class="cover-brand">${blueprint.authorOrBrand}</div>
      <h1 class="cover-title">${blueprint.title}</h1>
      <p class="cover-subtitle">${blueprint.subtitle}</p>
      <span class="cover-price-badge">Valor Sugerido: R$ ${blueprint.recommendedPriceBrl.toFixed(2)} · Licença Pessoal Exclusiva</span>
    </header>

    ${chaptersHtml}

    ${bonusesHtml}

    <footer class="footer-notice">
      <p>© ${new Date().getFullYear()} ${blueprint.authorOrBrand}. Todos os direitos reservados. Distribuição e reprodução não autorizadas são proibidas.</p>
    </footer>
  </div>
</body>
</html>`;
}
