import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { createClient } from "@/lib/supabase/server";
import { findWorkspace } from "@/lib/tenancy/service";
import { getStoreSettings } from "@/lib/store/repository";
import { StoreAdminClient } from "./StoreAdminClient";

export const metadata: Metadata = {
  title: "Gestão da Loja Virtual | SMKON Admin",
  description: "Gerenciamento completo de produtos físicos, digitais, achados Shopee, pedidos e aparência da loja.",
};

export default async function AdminLojaPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let workspaceId = "default";
  let userRole = "member";

  if (user) {
    const ws = await findWorkspace(supabase, user.id);
    if (ws) {
      workspaceId = ws.organizationId;
      userRole = ws.role;
    }
  }

  const initialSettings = await getStoreSettings(workspaceId);

  return (
    <div className="page">
      <PageHeader
        eyebrow="09 · Loja Virtual & Comercial"
        title="Gestão da Loja Virtual"
        description="Controle de produtos próprios, infoprodutos, achados da Shopee, pedidos, logística e pagamentos."
        actions={
          <div style={{ display: "flex", gap: "10px" }}>
            <Link className="store-btn store-btn-secondary" href="/loja" target="_blank" style={{ padding: "8px 14px", fontSize: "13px" }}>
              Abrir Loja Pública ↗
            </Link>
            <Link className="link" href="/admin" style={{ alignSelf: "center", fontSize: "13px" }}>
              Voltar ao Admin Geral
            </Link>
          </div>
        }
      />

      <StoreAdminClient
        workspaceId={workspaceId}
        userRole={userRole}
        initialSettings={initialSettings}
      />
    </div>
  );
}
