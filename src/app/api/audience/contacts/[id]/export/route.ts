import { contactExportResponse } from "@/lib/audience/export";
import { exportContactData } from "@/lib/audience/repository";
import { canManageAudience } from "@/lib/audience/service";
import { jsonError, toErrorResponse } from "@/lib/http/errors";
import { log } from "@/lib/observability/log";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/validation/fields";
import { findWorkspace } from "@/lib/tenancy/workspace";

/** Exportação (JSON) de tudo o que o workspace guarda sobre um titular. Só owner/admin; registrada no audit_log. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) return jsonError(400, "invalid_input", "Contato inválido.");
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return jsonError(401, "not_authenticated", "Não autenticado.");
    const workspace = await findWorkspace(supabase, user.id);
    if (!workspace || !canManageAudience(workspace.role)) return jsonError(403, "forbidden", "Apenas owner ou admin exportam dados de titulares.");
    const data = await exportContactData(supabase, id);
    log("info", "audience.export", { organizationId: workspace.organizationId, contactId: id });
    return contactExportResponse(id, data);
  } catch (error) {
    return toErrorResponse("api.audience.export", error, "Não foi possível exportar os dados do titular.");
  }
}
