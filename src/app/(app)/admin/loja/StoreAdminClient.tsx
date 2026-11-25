"use client";

import React, { useState, useEffect } from "react";
import type { StoreOrderView, StoreProduct, StoreSettings } from "@/lib/store/types";

function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

type TabType = "produtos" | "pedidos" | "metricas" | "aparencia";

export function StoreAdminClient({
  initialSettings,
}: {
  workspaceId?: string;
  userRole?: string;
  initialSettings: StoreSettings;
}) {
  const [activeTab, setActiveTab] = useState<TabType>("produtos");

  // Products state
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [showNewProductModal, setShowNewProductModal] = useState(false);

  // New product form state
  const [newProd, setNewProd] = useState({
    name: "",
    price_cents: 0,
    compare_at_price_cents: 0,
    category: "Tecnologia",
    fulfillment_mode: "internal_physical",
    sku: "",
    stock_quantity: 10,
    track_inventory: true,
    is_published_in_store: true,
    is_featured: false,
    image_url: "",
    affiliate_url: "",
    description: "",
    digital_benefits: "",
    weight_grams: 300,
  });

  // Orders state
  const [orders, setOrders] = useState<StoreOrderView[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [metrics, setMetrics] = useState({
    totalRevenueCents: 0,
    totalOrdersCount: 0,
    paidOrdersCount: 0,
    pendingOrdersCount: 0,
    averageTicketCents: 0,
  });

  // Order modal / tracking
  const [selectedOrder, setSelectedOrder] = useState<StoreOrderView | null>(null);
  const [trackingInput, setTrackingInput] = useState("");
  const [statusSelect, setStatusSelect] = useState("");

  // Settings state
  const [settings, setSettings] = useState<StoreSettings>(initialSettings);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsNotice, setSettingsNotice] = useState<string | null>(null);

  // Load products
  const fetchProducts = async () => {
    setProductsLoading(true);
    try {
      const res = await fetch("/api/admin/store/products");
      const data = await res.json();
      if (res.ok && Array.isArray(data.products)) {
        setProducts(data.products);
      }
    } catch {
      // Ignora erro de rede
    } finally {
      setProductsLoading(false);
    }
  };

  // Load orders
  const fetchOrders = async () => {
    setOrdersLoading(true);
    try {
      const res = await fetch("/api/admin/store/orders");
      const data = await res.json();
      if (res.ok) {
        setOrders(data.orders || []);
        if (data.metrics) setMetrics(data.metrics);
      }
    } catch {
      // Fallback
    } finally {
      setOrdersLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    const loadInitial = async () => {
      try {
        const [prodRes, ordRes] = await Promise.all([
          fetch("/api/admin/store/products"),
          fetch("/api/admin/store/orders"),
        ]);
        if (!mounted) return;
        const prodData = await prodRes.json();
        if (prodRes.ok && Array.isArray(prodData.products)) {
          setProducts(prodData.products);
        }
        const ordData = await ordRes.json();
        if (ordRes.ok) {
          setOrders(ordData.orders || []);
          if (ordData.metrics) setMetrics(ordData.metrics);
        }
      } catch {
        // Ignora erro de rede
      } finally {
        if (mounted) {
          setProductsLoading(false);
          setOrdersLoading(false);
        }
      }
    };
    void loadInitial();
    return () => {
      mounted = false;
    };
  }, []);

  const handleTogglePublish = async (product: StoreProduct) => {
    const updatedStatus = !product.is_published_in_store;
    try {
      const res = await fetch("/api/admin/store/products", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: product.id,
          is_published_in_store: updatedStatus,
        }),
      });
      if (res.ok) {
        setProducts((prev) =>
          prev.map((p) =>
            p.id === product.id ? { ...p, is_published_in_store: updatedStatus } : p
          )
        );
      }
    } catch {
      alert("Erro ao alterar publicação.");
    }
  };

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProd.name || newProd.price_cents <= 0) {
      alert("Preencha nome e preço válido.");
      return;
    }

    try {
      const payload = {
        ...newProd,
        image_urls: newProd.image_url ? [newProd.image_url] : ["/brand/brand-identity-board.jpg"],
        digital_benefits: newProd.digital_benefits
          ? newProd.digital_benefits.split("\n").filter(Boolean)
          : [],
      };

      const res = await fetch("/api/admin/store/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setShowNewProductModal(false);
        fetchProducts();
        alert("Produto cadastrado com sucesso!");
      } else {
        const err = await res.json();
        alert(err.error || "Erro ao cadastrar produto.");
      }
    } catch {
      alert("Erro de comunicação ao criar produto.");
    }
  };

  const handleUpdateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) return;

    try {
      const res = await fetch("/api/admin/store/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: selectedOrder.id,
          status: statusSelect || undefined,
          trackingCode: trackingInput || undefined,
        }),
      });

      if (res.ok) {
        setSelectedOrder(null);
        fetchOrders();
        alert("Pedido atualizado com sucesso!");
      }
    } catch {
      alert("Erro ao atualizar pedido.");
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    setSettingsNotice(null);

    try {
      const res = await fetch("/api/admin/store/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });

      if (res.ok) {
        setSettingsNotice("Configurações salvas com sucesso!");
        setTimeout(() => setSettingsNotice(null), 3500);
      }
    } catch {
      setSettingsNotice("Falha ao salvar configurações.");
    } finally {
      setSavingSettings(false);
    }
  };

  return (
    <div style={{ display: "grid", gap: "24px" }}>
      {/* Abas */}
      <div style={{ display: "flex", gap: "8px", borderBottom: "1px solid var(--line)", paddingBottom: "12px" }}>
        <button
          type="button"
          onClick={() => setActiveTab("produtos")}
          className={`app-nav-item ${activeTab === "produtos" ? "active" : ""}`}
          style={{ width: "auto", padding: "8px 18px", borderRadius: "8px" }}
        >
          🛍️ Produtos & Shopee ({products.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("pedidos")}
          className={`app-nav-item ${activeTab === "pedidos" ? "active" : ""}`}
          style={{ width: "auto", padding: "8px 18px", borderRadius: "8px" }}
        >
          📦 Pedidos & Envios ({orders.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("metricas")}
          className={`app-nav-item ${activeTab === "metricas" ? "active" : ""}`}
          style={{ width: "auto", padding: "8px 18px", borderRadius: "8px" }}
        >
          📈 Vendas & Métricas
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("aparencia")}
          className={`app-nav-item ${activeTab === "aparencia" ? "active" : ""}`}
          style={{ width: "auto", padding: "8px 18px", borderRadius: "8px" }}
        >
          ⚙️ Aparência & Integrações
        </button>
      </div>

      {/* ABA 1: PRODUTOS */}
      {activeTab === "produtos" && (
        <section className="panel">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
            <div>
              <h2 style={{ fontSize: "18px", fontWeight: "700", color: "#fff" }}>
                Produtos Cadastrados na Loja
              </h2>
              <p className="muted">
                Gerencie produtos físicos próprios, infoprodutos digitais e links oficiais de achados da Shopee.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowNewProductModal(true)}
              className="store-btn store-btn-primary"
              style={{ padding: "10px 18px", fontSize: "13px" }}
            >
              + Novo Produto / Achado
            </button>
          </div>

          {productsLoading ? (
            <div style={{ padding: "40px", textAlign: "center", color: "var(--muted)" }}>
              Carregando catálogo...
            </div>
          ) : products.length === 0 ? (
            <div style={{ padding: "40px", textAlign: "center", color: "var(--muted)" }}>
              Nenhum produto cadastrado no catálogo ainda.
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--line)", textAlign: "left", color: "var(--muted)" }}>
                    <th style={{ padding: "12px 8px" }}>Produto</th>
                    <th style={{ padding: "12px 8px" }}>Tipo</th>
                    <th style={{ padding: "12px 8px" }}>Categoria</th>
                    <th style={{ padding: "12px 8px" }}>Preço</th>
                    <th style={{ padding: "12px 8px" }}>Estoque</th>
                    <th style={{ padding: "12px 8px" }}>Na Loja?</th>
                    <th style={{ padding: "12px 8px" }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p) => (
                    <tr key={p.id} style={{ borderBottom: "1px solid var(--line)" }}>
                      <td style={{ padding: "12px 8px" }}>
                        <div style={{ fontWeight: "600", color: "#fff" }}>{p.name}</div>
                        {p.sku && <div style={{ fontSize: "11px", color: "var(--muted)" }}>SKU: {p.sku}</div>}
                      </td>
                      <td style={{ padding: "12px 8px" }}>
                        <span
                          style={{
                            fontSize: "11px",
                            padding: "3px 8px",
                            borderRadius: "4px",
                            background:
                              p.fulfillment_mode === "external_affiliate"
                                ? "rgba(238, 77, 45, 0.2)"
                                : p.fulfillment_mode === "internal_digital"
                                ? "rgba(124, 58, 237, 0.2)"
                                : "rgba(37, 99, 255, 0.2)",
                            color:
                              p.fulfillment_mode === "external_affiliate"
                                ? "var(--store-shopee)"
                                : p.fulfillment_mode === "internal_digital"
                                ? "#c084fc"
                                : "#6ea8fe",
                          }}
                        >
                          {p.fulfillment_mode === "external_affiliate"
                            ? "Shopee Afiliado"
                            : p.fulfillment_mode === "internal_digital"
                            ? "Infoproduto"
                            : "Físico Próprio"}
                        </span>
                      </td>
                      <td style={{ padding: "12px 8px" }}>{p.category}</td>
                      <td style={{ padding: "12px 8px", fontWeight: "600", color: "#fff" }}>
                        {formatBRL(p.price_cents)}
                      </td>
                      <td style={{ padding: "12px 8px" }}>
                        {p.fulfillment_mode === "external_affiliate" ? (
                          <span style={{ color: "var(--muted)" }}>Externo</span>
                        ) : p.track_inventory ? (
                          `${p.stock_quantity} un.`
                        ) : (
                          "Infinito"
                        )}
                      </td>
                      <td style={{ padding: "12px 8px" }}>
                        <button
                          type="button"
                          onClick={() => handleTogglePublish(p)}
                          style={{
                            padding: "4px 10px",
                            fontSize: "11px",
                            borderRadius: "999px",
                            border: "1px solid",
                            background: p.is_published_in_store ? "rgba(34, 197, 94, 0.15)" : "rgba(255, 255, 255, 0.05)",
                            borderColor: p.is_published_in_store ? "var(--ok)" : "var(--line)",
                            color: p.is_published_in_store ? "var(--ok)" : "var(--muted)",
                            cursor: "pointer",
                          }}
                        >
                          {p.is_published_in_store ? "✓ Publicado" : "Oculto"}
                        </button>
                      </td>
                      <td style={{ padding: "12px 8px" }}>
                        <a
                          href={`/loja/produtos/${p.slug || p.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="link"
                          style={{ fontSize: "12px" }}
                        >
                          Ver na Loja ↗
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* ABA 2: PEDIDOS */}
      {activeTab === "pedidos" && (
        <section className="panel">
          <div style={{ marginBottom: "20px" }}>
            <h2 style={{ fontSize: "18px", fontWeight: "700", color: "#fff" }}>
              Pedidos da Loja Virtual
            </h2>
            <p className="muted">
              Consulte pedidos, pagamentos processados via PIX/Cartão e envie códigos de rastreamento.
            </p>
          </div>

          {ordersLoading ? (
            <div style={{ padding: "40px", textAlign: "center", color: "var(--muted)" }}>
              Carregando pedidos...
            </div>
          ) : orders.length === 0 ? (
            <div style={{ padding: "40px", textAlign: "center", color: "var(--muted)" }}>
              Nenhum pedido registrado até o momento.
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--line)", textAlign: "left", color: "var(--muted)" }}>
                    <th style={{ padding: "12px 8px" }}>Código</th>
                    <th style={{ padding: "12px 8px" }}>Cliente</th>
                    <th style={{ padding: "12px 8px" }}>Total</th>
                    <th style={{ padding: "12px 8px" }}>Pagamento</th>
                    <th style={{ padding: "12px 8px" }}>Status</th>
                    <th style={{ padding: "12px 8px" }}>Rastreio</th>
                    <th style={{ padding: "12px 8px" }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => (
                    <tr key={o.id} style={{ borderBottom: "1px solid var(--line)" }}>
                      <td style={{ padding: "12px 8px", fontWeight: "700", color: "var(--store-accent)" }}>
                        {o.order_code}
                      </td>
                      <td style={{ padding: "12px 8px" }}>
                        <div style={{ color: "#fff" }}>{o.customer_name}</div>
                        <div style={{ fontSize: "11px", color: "var(--muted)" }}>{o.customer_email}</div>
                      </td>
                      <td style={{ padding: "12px 8px", fontWeight: "700", color: "#fff" }}>
                        {formatBRL(o.total_amount_cents)}
                      </td>
                      <td style={{ padding: "12px 8px" }}>
                        <span
                          style={{
                            fontSize: "11px",
                            padding: "3px 8px",
                            borderRadius: "4px",
                            background:
                              o.payment_status === "approved"
                                ? "rgba(34, 197, 94, 0.2)"
                                : "rgba(245, 158, 11, 0.2)",
                            color:
                              o.payment_status === "approved"
                                ? "var(--ok)"
                                : "var(--warn)",
                          }}
                        >
                          {o.payment_status === "approved" ? "Aprovado" : "Pendente"}
                        </span>
                      </td>
                      <td style={{ padding: "12px 8px" }}>{o.status}</td>
                      <td style={{ padding: "12px 8px" }}>
                        {o.tracking_code ? (
                          <code style={{ color: "var(--store-accent)" }}>{o.tracking_code}</code>
                        ) : (
                          <span style={{ color: "var(--muted)" }}>Sem rastreio</span>
                        )}
                      </td>
                      <td style={{ padding: "12px 8px" }}>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedOrder(o);
                            setStatusSelect(o.status);
                            setTrackingInput(o.tracking_code || "");
                          }}
                          className="store-btn store-btn-secondary"
                          style={{ padding: "4px 10px", fontSize: "11px" }}
                        >
                          Gerenciar ↗
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* ABA 3: VENDAS & MÉTRICAS */}
      {activeTab === "metricas" && (
        <section className="panel">
          <div style={{ marginBottom: "24px" }}>
            <h2 style={{ fontSize: "18px", fontWeight: "700", color: "#fff" }}>
              Desempenho Comercial da Loja
            </h2>
            <p className="muted">
              Métricas reais consolidadas de compras concluídas e faturamento no workspace.
            </p>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: "16px",
              marginBottom: "32px",
            }}
          >
            <div style={{ background: "var(--surface-2)", padding: "20px", borderRadius: "10px", border: "1px solid var(--line)" }}>
              <div style={{ fontSize: "12px", color: "var(--muted)", textTransform: "uppercase" }}>Faturamento Total</div>
              <div style={{ fontSize: "26px", fontWeight: "800", color: "var(--store-accent)", marginTop: "6px" }}>
                {formatBRL(metrics.totalRevenueCents)}
              </div>
            </div>

            <div style={{ background: "var(--surface-2)", padding: "20px", borderRadius: "10px", border: "1px solid var(--line)" }}>
              <div style={{ fontSize: "12px", color: "var(--muted)", textTransform: "uppercase" }}>Pedidos Pagos</div>
              <div style={{ fontSize: "26px", fontWeight: "800", color: "var(--ok)", marginTop: "6px" }}>
                {metrics.paidOrdersCount}
              </div>
            </div>

            <div style={{ background: "var(--surface-2)", padding: "20px", borderRadius: "10px", border: "1px solid var(--line)" }}>
              <div style={{ fontSize: "12px", color: "var(--muted)", textTransform: "uppercase" }}>Ticket Médio</div>
              <div style={{ fontSize: "26px", fontWeight: "800", color: "#fff", marginTop: "6px" }}>
                {formatBRL(metrics.averageTicketCents)}
              </div>
            </div>

            <div style={{ background: "var(--surface-2)", padding: "20px", borderRadius: "10px", border: "1px solid var(--line)" }}>
              <div style={{ fontSize: "12px", color: "var(--muted)", textTransform: "uppercase" }}>Aguardando Pagamento</div>
              <div style={{ fontSize: "26px", fontWeight: "800", color: "var(--warn)", marginTop: "6px" }}>
                {metrics.pendingOrdersCount}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ABA 4: APARÊNCIA & INTEGRAÇÕES */}
      {activeTab === "aparencia" && (
        <section className="panel">
          <div style={{ marginBottom: "24px" }}>
            <h2 style={{ fontSize: "18px", fontWeight: "700", color: "#fff" }}>
              Aparência da Loja & Integrações
            </h2>
            <p className="muted">
              Configure banners de destaque, contatos, dados de envio e veja o status das APIs de pagamento e frete.
            </p>
          </div>

          <form onSubmit={handleSaveSettings} style={{ display: "grid", gap: "20px", maxWidth: "640px" }}>
            <div>
              <label style={{ display: "block", fontSize: "12px", color: "var(--muted)", marginBottom: "4px" }}>
                Nome da Loja
              </label>
              <input
                type="text"
                value={settings.store_name}
                onChange={(e) => setSettings({ ...settings, store_name: e.target.value })}
                className="store-search-input"
                style={{ borderRadius: "8px", height: "40px" }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: "12px", color: "var(--muted)", marginBottom: "4px" }}>
                Slogan / Tagline
              </label>
              <input
                type="text"
                value={settings.store_tagline}
                onChange={(e) => setSettings({ ...settings, store_tagline: e.target.value })}
                className="store-search-input"
                style={{ borderRadius: "8px", height: "40px" }}
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
              <div>
                <label style={{ display: "block", fontSize: "12px", color: "var(--muted)", marginBottom: "4px" }}>
                  CEP de Origem do Frete (Seu CD)
                </label>
                <input
                  type="text"
                  value={settings.shipping_origin_cep}
                  onChange={(e) => setSettings({ ...settings, shipping_origin_cep: e.target.value })}
                  className="store-search-input"
                  style={{ borderRadius: "8px", height: "40px" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", color: "var(--muted)", marginBottom: "4px" }}>
                  WhatsApp de Suporte
                </label>
                <input
                  type="text"
                  value={settings.support_whatsapp || ""}
                  onChange={(e) => setSettings({ ...settings, support_whatsapp: e.target.value })}
                  className="store-search-input"
                  style={{ borderRadius: "8px", height: "40px" }}
                />
              </div>
            </div>

            {/* Status das Integrações */}
            <div style={{ marginTop: "12px", borderTop: "1px solid var(--line)", paddingTop: "16px" }}>
              <h3 style={{ fontSize: "14px", fontWeight: "700", color: "#fff", marginBottom: "12px" }}>
                Status dos Provedores Integrados
              </h3>

              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <div style={{ background: "var(--surface-2)", padding: "14px", borderRadius: "8px", border: "1px solid var(--line)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <strong>Mercado Pago (PIX & Cartão)</strong>
                    <span style={{ fontSize: "11px", color: "var(--ok)", background: "rgba(34, 197, 94, 0.15)", padding: "2px 8px", borderRadius: "4px" }}>
                      Ativo
                    </span>
                  </div>
                  <div style={{ fontSize: "11px", color: "var(--muted)", marginTop: "4px" }}>
                    Webhook URL: <code style={{ color: "var(--store-accent)" }}>/api/webhooks/mercadopago</code>
                  </div>
                </div>

                <div style={{ background: "var(--surface-2)", padding: "14px", borderRadius: "8px", border: "1px solid var(--line)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <strong>Melhor Envio (Cotação de Frete & Logística)</strong>
                    <span style={{ fontSize: "11px", color: "var(--ok)", background: "rgba(34, 197, 94, 0.15)", padding: "2px 8px", borderRadius: "4px" }}>
                      Ativo
                    </span>
                  </div>
                  <div style={{ fontSize: "11px", color: "var(--muted)", marginTop: "4px" }}>
                    Cotação em tempo real para Correios (PAC/SEDEX) e transportadoras parceiras.
                  </div>
                </div>
              </div>
            </div>

            {settingsNotice && (
              <div style={{ color: "var(--ok)", fontSize: "13px" }}>{settingsNotice}</div>
            )}

            <button
              type="submit"
              disabled={savingSettings}
              className="store-btn store-btn-primary"
              style={{ width: "200px", padding: "12px" }}
            >
              {savingSettings ? "Salvando..." : "Salvar Configurações"}
            </button>
          </form>
        </section>
      )}

      {/* Modal de Novo Produto */}
      {showNewProductModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.75)",
            backdropFilter: "blur(6px)",
            zIndex: 60,
            display: "grid",
            placeItems: "center",
            padding: "20px",
          }}
          onClick={() => setShowNewProductModal(false)}
        >
          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--line-strong)",
              borderRadius: "16px",
              padding: "28px",
              maxWidth: "540px",
              width: "100%",
              maxHeight: "90vh",
              overflowY: "auto",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "16px" }}>
              <h3 style={{ fontSize: "18px", fontWeight: "700", color: "#fff" }}>
                Cadastrar Novo Item na Loja
              </h3>
              <button
                type="button"
                onClick={() => setShowNewProductModal(false)}
                style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", fontSize: "18px" }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateProduct} style={{ display: "grid", gap: "14px" }}>
              <div>
                <label style={{ display: "block", fontSize: "12px", color: "var(--muted)", marginBottom: "4px" }}>
                  Tipo de Produto *
                </label>
                <select
                  value={newProd.fulfillment_mode}
                  onChange={(e) => setNewProd({ ...newProd, fulfillment_mode: e.target.value })}
                  style={{
                    width: "100%",
                    height: "38px",
                    background: "var(--surface-2)",
                    border: "1px solid var(--line)",
                    borderRadius: "6px",
                    color: "#fff",
                    padding: "0 10px",
                  }}
                >
                  <option value="internal_physical">Físico Próprio (com frete e estoque)</option>
                  <option value="internal_digital">Infoproduto (entrega digital por link/download)</option>
                  <option value="external_affiliate">Achado da Shopee (Link de Afiliado Oficial)</option>
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", color: "var(--muted)", marginBottom: "4px" }}>
                  Nome do Produto *
                </label>
                <input
                  type="text"
                  required
                  value={newProd.name}
                  onChange={(e) => setNewProd({ ...newProd, name: e.target.value })}
                  className="store-search-input"
                  style={{ borderRadius: "8px", height: "38px" }}
                  placeholder="Ex: Teclado Mecânico RGB Pro"
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", color: "var(--muted)", marginBottom: "4px" }}>
                    Preço (em centavos: R$ 99,90 = 9990) *
                  </label>
                  <input
                    type="number"
                    required
                    value={newProd.price_cents || ""}
                    onChange={(e) => setNewProd({ ...newProd, price_cents: Number(e.target.value) })}
                    className="store-search-input"
                    style={{ borderRadius: "8px", height: "38px" }}
                    placeholder="9990"
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "12px", color: "var(--muted)", marginBottom: "4px" }}>
                    Categoria
                  </label>
                  <input
                    type="text"
                    value={newProd.category}
                    onChange={(e) => setNewProd({ ...newProd, category: e.target.value })}
                    className="store-search-input"
                    style={{ borderRadius: "8px", height: "38px" }}
                    placeholder="Tecnologia, Periféricos..."
                  />
                </div>
              </div>

              {newProd.fulfillment_mode === "external_affiliate" ? (
                <div>
                  <label style={{ display: "block", fontSize: "12px", color: "var(--store-shopee)", fontWeight: "600", marginBottom: "4px" }}>
                    Link Oficial da Shopee (Afiliado) *
                  </label>
                  <input
                    type="url"
                    required
                    value={newProd.affiliate_url}
                    onChange={(e) => setNewProd({ ...newProd, affiliate_url: e.target.value })}
                    className="store-search-input"
                    style={{ borderRadius: "8px", height: "38px", borderColor: "rgba(238, 77, 45, 0.4)" }}
                    placeholder="https://shope.ee/..."
                  />
                </div>
              ) : newProd.fulfillment_mode === "internal_digital" ? (
                <div>
                  <label style={{ display: "block", fontSize: "12px", color: "var(--store-secondary)", fontWeight: "600", marginBottom: "4px" }}>
                    Benefícios / Conteúdos Inclusos (um por linha)
                  </label>
                  <textarea
                    rows={3}
                    value={newProd.digital_benefits}
                    onChange={(e) => setNewProd({ ...newProd, digital_benefits: e.target.value })}
                    className="store-search-input"
                    style={{ borderRadius: "8px", height: "80px", padding: "10px" }}
                    placeholder="Acesso vitalício aos templates&#10;Planilha de precificação comercial&#10;Vídeo aula de configuração"
                  />
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "12px", color: "var(--muted)", marginBottom: "4px" }}>
                      Estoque Inicial
                    </label>
                    <input
                      type="number"
                      value={newProd.stock_quantity}
                      onChange={(e) => setNewProd({ ...newProd, stock_quantity: Number(e.target.value) })}
                      className="store-search-input"
                      style={{ borderRadius: "8px", height: "38px" }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "12px", color: "var(--muted)", marginBottom: "4px" }}>
                      SKU
                    </label>
                    <input
                      type="text"
                      value={newProd.sku}
                      onChange={(e) => setNewProd({ ...newProd, sku: e.target.value })}
                      className="store-search-input"
                      style={{ borderRadius: "8px", height: "38px" }}
                      placeholder="SMK-TEC-001"
                    />
                  </div>
                </div>
              )}

              <div>
                <label style={{ display: "block", fontSize: "12px", color: "var(--muted)", marginBottom: "4px" }}>
                  URL da Imagem do Produto
                </label>
                <input
                  type="text"
                  value={newProd.image_url}
                  onChange={(e) => setNewProd({ ...newProd, image_url: e.target.value })}
                  className="store-search-input"
                  style={{ borderRadius: "8px", height: "38px" }}
                  placeholder="/brand/brand-identity-board.jpg ou link externo https://..."
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", color: "var(--muted)", marginBottom: "4px" }}>
                  Descrição Completa
                </label>
                <textarea
                  rows={3}
                  value={newProd.description}
                  onChange={(e) => setNewProd({ ...newProd, description: e.target.value })}
                  className="store-search-input"
                  style={{ borderRadius: "8px", height: "80px", padding: "10px" }}
                  placeholder="Detalhes, especificações e diferenciais do item..."
                />
              </div>

              <button
                type="submit"
                className="store-btn store-btn-primary"
                style={{ width: "100%", padding: "14px", marginTop: "10px" }}
              >
                Cadastrar e Publicar na Loja
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Gestão de Pedido */}
      {selectedOrder && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.75)",
            backdropFilter: "blur(6px)",
            zIndex: 60,
            display: "grid",
            placeItems: "center",
            padding: "20px",
          }}
          onClick={() => setSelectedOrder(null)}
        >
          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--line-strong)",
              borderRadius: "16px",
              padding: "28px",
              maxWidth: "500px",
              width: "100%",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ fontSize: "18px", fontWeight: "700", color: "#fff", marginBottom: "12px" }}>
              Gerenciar Pedido #{selectedOrder.order_code}
            </h3>

            <div style={{ fontSize: "13px", color: "var(--muted)", marginBottom: "16px" }}>
              Cliente: <strong style={{ color: "#fff" }}>{selectedOrder.customer_name}</strong> · Total: {formatBRL(selectedOrder.total_amount_cents)}
            </div>

            <form onSubmit={handleUpdateOrder} style={{ display: "grid", gap: "14px" }}>
              <div>
                <label style={{ display: "block", fontSize: "12px", color: "var(--muted)", marginBottom: "4px" }}>
                  Status do Pedido
                </label>
                <select
                  value={statusSelect}
                  onChange={(e) => setStatusSelect(e.target.value)}
                  style={{
                    width: "100%",
                    height: "38px",
                    background: "var(--surface-2)",
                    border: "1px solid var(--line)",
                    borderRadius: "6px",
                    color: "#fff",
                    padding: "0 10px",
                  }}
                >
                  <option value="awaiting_payment">Aguardando Pagamento</option>
                  <option value="payment_confirmed">Pagamento Confirmado</option>
                  <option value="preparing">Em Separação</option>
                  <option value="shipped">Enviado / Em Transporte</option>
                  <option value="delivered">Entregue</option>
                  <option value="cancelled">Cancelado</option>
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", color: "var(--muted)", marginBottom: "4px" }}>
                  Código de Rastreamento (Correios / Transportadora)
                </label>
                <input
                  type="text"
                  value={trackingInput}
                  onChange={(e) => setTrackingInput(e.target.value.toUpperCase())}
                  className="store-search-input"
                  style={{ borderRadius: "8px", height: "38px" }}
                  placeholder="Ex: NL123456789BR"
                />
              </div>

              <div style={{ display: "flex", gap: "10px", marginTop: "12px" }}>
                <button
                  type="button"
                  onClick={() => setSelectedOrder(null)}
                  className="store-btn store-btn-secondary"
                  style={{ flex: 1, padding: "12px" }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="store-btn store-btn-primary"
                  style={{ flex: 1, padding: "12px" }}
                >
                  Salvar Alterações
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
