import type { WorkspaceOverview } from "./types.ts";

export type OnboardingStep = {
  id: string;
  title: string;
  description: string;
  href: string;
  action: string;
  done: boolean;
};

/**
 * Primeiros passos do ciclo SMKON (oportunidade → produto → conteúdo → aprovação → distribuição),
 * calculados só a partir dos números reais do workspace. Nada é marcado à mão.
 */
export function onboardingSteps(data: WorkspaceOverview): OnboardingStep[] {
  const scheduled =
    data.publication.next_7_days +
    data.publication.awaiting_dry_run +
    data.publication.dry_run_passed +
    data.publication.dry_run_failed;
  return [
    {
      id: "product",
      title: "Cadastre o primeiro produto",
      description: "Produto próprio, de afiliado ou infoproduto, com o domínio financeiro certo.",
      href: "/produtos",
      action: "Cadastrar produto",
      done: data.products.total > 0,
    },
    {
      id: "evidence",
      title: "Registre e revise uma evidência",
      description: "O score do produto só nasce de evidência verificada (fonte https, data e valor).",
      href: "/produtos",
      action: "Abrir produtos",
      done: data.products.scored > 0,
    },
    {
      id: "content",
      title: "Crie um conteúdo no Studio",
      description: "Roteiro, legenda, CTA e canais, partindo de um modelo se quiser.",
      href: "/studio",
      action: "Abrir Studio",
      done: data.content.total > 0,
    },
    {
      id: "approve",
      title: "Aprove a versão exata",
      description: "A aprovação fica presa ao hash: qualquer edição exige nova aprovação.",
      href: "/studio",
      action: "Revisar conteúdo",
      done: data.content.approved > 0,
    },
    {
      id: "schedule",
      title: "Agende e rode o dry-run",
      description: "O calendário confere aprovação, licença de mídia e canal antes de qualquer publicação.",
      href: "/calendario",
      action: "Abrir calendário",
      done: scheduled > 0,
    },
    {
      id: "connect",
      title: "Conecte uma plataforma",
      description: "Hotmart, Mercado Livre ou Metricool. Veja antes o que falta configurar.",
      href: "/admin#prontidao",
      action: "Ver prontidão",
      done: data.connections.connected > 0,
    },
  ];
}
