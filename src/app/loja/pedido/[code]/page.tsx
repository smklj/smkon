import React from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getStoreOrderByCode } from "@/lib/store/repository";
import { OrderPixBox } from "./OrderPixBox";

function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

type Props = {
  params: Promise<{ code: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { code } = await params;
  return {
    title: `Pedido #${code} | SMKON Loja Oficial`,
  };
}

export default async function OrderPage({ params }: Props) {
  const { code } = await params;
  if (code.toLowerCase() === "rastrear") {
    redirect("/loja/rastrear");
  }
  const order = await getStoreOrderByCode(code);

  if (!order) {
    notFound();
  }

  const isPaid =
    order.payment_status === "approved" ||
    order.status === "payment_confirmed" ||
    order.status === "delivered" ||
    order.status === "shipped" ||
    order.status === "completed";

  const isPix = order.payment_method === "pix";
  const dummyQr = `00020126580014br.gov.bcb.pix0136smkon-${order.order_code}520400005303986540${(order.total_amount_cents / 100).toFixed(2)}5802BR5916SMKON LOJA OFICIAL6009SAO PAULO62070503***6304ABCD`;

  return (
    <div style={{ maxWidth: "880px", margin: "0 auto" }}>
      {/* Header do Status */}
      <div
        style={{
          background: isPaid ? "rgba(34, 197, 94, 0.1)" : "rgba(37, 99, 255, 0.1)",
          border: `1px solid ${isPaid ? "rgba(34, 197, 94, 0.3)" : "rgba(37, 99, 255, 0.3)"}`,
          borderRadius: "16px",
          padding: "28px",
          textAlign: "center",
          marginBottom: "32px",
        }}
      >
        <span style={{ fontSize: "48px" }}>{isPaid ? "🎉" : "⏳"}</span>
        <h1 style={{ fontSize: "24px", fontWeight: "800", color: "#fff", marginTop: "12px", marginBottom: "6px" }}>
          {isPaid ? "Pagamento Confirmado com Sucesso!" : "Pedido Realizado — Aguardando Pagamento"}
        </h1>
        <p style={{ color: "var(--store-muted)", fontSize: "14px" }}>
          Código do Pedido: <strong style={{ color: "#fff" }}>{order.order_code}</strong> · Realizado em{" "}
          {new Date(order.created_at).toLocaleDateString("pt-BR")} às{" "}
          {new Date(order.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
        </p>
      </div>

      {/* Caixa de PIX caso esteja aguardando pagamento */}
      {!isPaid && isPix && (
        <OrderPixBox
          orderCode={order.order_code}
          totalAmountCents={order.total_amount_cents}
          qrCodeCopy={dummyQr}
        />
      )}

      {/* Entregas Digitais Liberadas */}
      {isPaid && order.digital_deliveries && order.digital_deliveries.length > 0 && (
        <div
          style={{
            background: "linear-gradient(180deg, rgba(124, 58, 237, 0.12) 0%, rgba(17, 22, 31, 0.9) 100%)",
            border: "1px solid rgba(124, 58, 237, 0.35)",
            borderRadius: "16px",
            padding: "24px",
            marginBottom: "32px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
            <span style={{ fontSize: "24px" }}>💻</span>
            <div>
              <h2 style={{ fontSize: "18px", fontWeight: "700", color: "#fff" }}>
                Seus Infoprodutos e Soluções Digitais
              </h2>
              <p style={{ fontSize: "12px", color: "var(--store-muted)" }}>
                Arquivos e acessos liberados exclusivamente para você.
              </p>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {order.digital_deliveries.map((delivery) => (
              <div
                key={delivery.id}
                style={{
                  background: "var(--store-surface)",
                  border: "1px solid var(--store-border)",
                  borderRadius: "10px",
                  padding: "16px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "16px",
                  flexWrap: "wrap",
                }}
              >
                <div>
                  <h4 style={{ fontSize: "15px", fontWeight: "600", color: "#fff", marginBottom: "4px" }}>
                    {delivery.product_name}
                  </h4>
                  <div style={{ fontSize: "12px", color: "var(--store-muted)" }}>
                    Token de segurança: <code style={{ color: "var(--store-accent)" }}>{delivery.access_token.slice(0, 16)}...</code> · Validade até {new Date(delivery.expires_at).toLocaleDateString("pt-BR")}
                  </div>
                  {delivery.instructions && (
                    <div style={{ fontSize: "12px", color: "#e2e8f0", marginTop: "4px" }}>
                      {delivery.instructions}
                    </div>
                  )}
                </div>

                <a
                  href={delivery.external_url || `/api/store/download/${delivery.access_token}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="store-btn store-btn-primary"
                  style={{ padding: "10px 18px", fontSize: "13px" }}
                >
                  Baixar / Acessar Conteúdo ⬇
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Rastreamento de Envio */}
      {order.shipping_carrier_name && (
        <div
          style={{
            background: "var(--store-surface)",
            border: "1px solid var(--store-border)",
            borderRadius: "16px",
            padding: "24px",
            marginBottom: "32px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px", marginBottom: "16px" }}>
            <h2 style={{ fontSize: "18px", fontWeight: "700", color: "#fff" }}>
              📦 Status do Envio & Rastreamento
            </h2>
            {order.tracking_code && (
              <span style={{ fontSize: "13px", color: "var(--store-accent)", fontWeight: "600" }}>
                Código de Rastreio: {order.tracking_code}
              </span>
            )}
          </div>

          <div style={{ fontSize: "13px", color: "var(--store-muted)", marginBottom: "16px" }}>
            Transportadora: <strong style={{ color: "#fff" }}>{order.shipping_carrier_name}</strong> ({order.shipping_service_name || "Envio Padrão"}) · Prazo estimado: {order.shipping_estimated_days || 5} dias úteis
          </div>

          {order.shipment_events && order.shipment_events.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px", borderLeft: "2px solid var(--store-border)", paddingLeft: "16px", marginLeft: "8px" }}>
              {order.shipment_events.map((evt) => (
                <div key={evt.id} style={{ position: "relative" }}>
                  <div style={{ position: "absolute", left: "-22px", top: "3px", width: "10px", height: "10px", borderRadius: "50%", background: "var(--store-accent)" }} />
                  <div style={{ fontSize: "13px", fontWeight: "600", color: "#fff" }}>{evt.description}</div>
                  <div style={{ fontSize: "11px", color: "var(--store-muted)" }}>
                    {new Date(evt.occurred_at).toLocaleString("pt-BR")} {evt.location ? `· ${evt.location}` : ""}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: "13px", color: "var(--store-muted)" }}>
              {isPaid
                ? "Seu pedido está sendo separado no centro de distribuição. O código de rastreamento será atualizado em breve."
                : "Aguardando confirmação do pagamento para liberação do envio."}
            </div>
          )}
        </div>
      )}

      {/* Detalhes do Pedido e Itens */}
      <div
        style={{
          background: "var(--store-surface)",
          border: "1px solid var(--store-border)",
          borderRadius: "16px",
          padding: "24px",
          display: "flex",
          flexDirection: "column",
          gap: "18px",
          marginBottom: "32px",
        }}
      >
        <h2 style={{ fontSize: "18px", fontWeight: "700", color: "#fff" }}>Itens Comprados</h2>

        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          {order.items.map((item) => (
            <div key={item.id} style={{ display: "flex", gap: "14px", alignItems: "center", borderBottom: "1px solid var(--store-border)", paddingBottom: "12px" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.image_url || "/brand/brand-identity-board.jpg"}
                alt={item.product_name}
                style={{ width: "56px", height: "56px", borderRadius: "8px", objectFit: "cover" }}
              />
              <div style={{ flex: 1 }}>
                <h4 style={{ fontSize: "14px", fontWeight: "600", color: "#fff", margin: 0 }}>
                  <Link href={`/loja/produtos/${item.product_slug}`}>{item.product_name}</Link>
                </h4>
                <div style={{ fontSize: "12px", color: "var(--store-muted)" }}>
                  Qtd: {item.quantity} · Preço: {formatBRL(item.unit_price_cents)}
                </div>
              </div>
              <div style={{ fontSize: "14px", fontWeight: "700", color: "#fff" }}>
                {formatBRL(item.subtotal_cents)}
              </div>
            </div>
          ))}
        </div>

        {/* Totais */}
        <div style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "13px", borderTop: "1px solid var(--store-border)", paddingTop: "12px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", color: "var(--store-muted)" }}>
            <span>Subtotal</span>
            <span>{formatBRL(order.items_subtotal_cents)}</span>
          </div>

          {order.discount_amount_cents > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", color: "var(--store-success)" }}>
              <span>Desconto</span>
              <span>-{formatBRL(order.discount_amount_cents)}</span>
            </div>
          )}

          {order.shipping_amount_cents > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", color: "var(--store-muted)" }}>
              <span>Frete</span>
              <span>{formatBRL(order.shipping_amount_cents)}</span>
            </div>
          )}

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontWeight: "800",
              fontSize: "18px",
              color: "#fff",
              borderTop: "1px solid var(--store-border)",
              paddingTop: "10px",
              marginTop: "4px",
            }}
          >
            <span>Total Pago</span>
            <span style={{ color: "var(--store-accent)" }}>{formatBRL(order.total_amount_cents)}</span>
          </div>
        </div>
      </div>

      <div style={{ textAlign: "center", marginBottom: "40px" }}>
        <Link href="/loja" className="store-btn store-btn-secondary">
          Voltar para a Página Inicial da Loja ↗
        </Link>
      </div>
    </div>
  );
}
