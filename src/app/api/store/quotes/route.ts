import { NextResponse, type NextRequest } from "next/server";
import { log } from "@/lib/observability/log";
import { getStoreSettings } from "@/lib/store/repository";
import {
  calculateSoftwareQuote,
  type SoftwareAddonId,
  type SoftwareProjectType,
  type SoftwareUrgency,
} from "@/lib/store/quote-engine";

function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      clientName?: string;
      clientEmail?: string;
      clientWhatsapp?: string;
      companyName?: string;
      notes?: string;
      projectType?: SoftwareProjectType;
      addons?: SoftwareAddonId[];
      urgency?: SoftwareUrgency;
      pagesOrEndpoints?: number;
    };

    const clientName = String(body.clientName || "").trim();
    const clientContact = String(body.clientWhatsapp || body.clientEmail || "").trim();

    if (!clientName || !clientContact) {
      return NextResponse.json(
        { error: "Informe seu nome e WhatsApp ou e-mail para gerar a proposta." },
        { status: 400 },
      );
    }

    const quote = calculateSoftwareQuote({
      projectType: body.projectType || "institutional_site",
      addons: Array.isArray(body.addons) ? body.addons : [],
      urgency: body.urgency || "standard",
      pagesOrEndpoints: Number(body.pagesOrEndpoints || 5),
    });

    const protocol = `ORC-${new Date().toISOString().slice(2, 10).replace(/-/g, "")}-${Math.floor(1000 + Math.random() * 9000)}`;
    const settings = await getStoreSettings();

    log("info", "store.software_quote.created", {
      protocol,
      projectType: quote.projectType,
      minEstimateCents: quote.minEstimateCents,
      maxEstimateCents: quote.maxEstimateCents,
      estimatedDays: quote.estimatedDays,
    });

    const summaryText = [
      `*PROPOSTA SMKON ENGINEERING (${protocol})*`,
      `Cliente: ${clientName}${body.companyName ? ` (${body.companyName})` : ""}`,
      `Contato: ${clientContact}`,
      `Projeto: ${quote.projectLabel}`,
      `Estimativa: ${formatBRL(quote.minEstimateCents)} a ${formatBRL(quote.maxEstimateCents)}`,
      `Prazo estimado: ${quote.estimatedDays} dias úteis`,
      body.notes ? `Detalhes: ${body.notes.slice(0, 300)}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    const whatsappNumber = (settings.support_whatsapp || "").replace(/\D/g, "");
    const whatsappUrl = whatsappNumber
      ? `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(summaryText)}`
      : null;

    return NextResponse.json({
      protocol,
      quote,
      whatsappUrl,
      summaryText,
    });
  } catch {
    return NextResponse.json(
      { error: "Erro ao processar orçamento." },
      { status: 500 },
    );
  }
}
