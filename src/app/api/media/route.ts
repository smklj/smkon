import { NextResponse } from "next/server";
import { jsonError, toErrorResponse } from "@/lib/http/errors";
import { listMedia } from "@/lib/media/server";
import { licenseStatus, todayInBrazil } from "@/lib/media/types";
import { createClient } from "@/lib/supabase/server";
import { findWorkspace } from "@/lib/tenancy/workspace";

/** Mídia não arquivada do workspace, com o estado da licença (para o seletor do Content Studio). */
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return jsonError(401, "not_authenticated", "Não autenticado.");
    const workspace = await findWorkspace(supabase, user.id);
    if (!workspace) return NextResponse.json({ items: [] });
    const today = todayInBrazil();
    const media = await listMedia(supabase, workspace.organizationId);
    return NextResponse.json(
      {
        items: media.map((asset) => ({
          id: asset.id,
          name: asset.original_name,
          kind: asset.kind,
          licenseStatus: licenseStatus(asset.licenses, today),
        })),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return toErrorResponse("api.media.get", error, "Não foi possível carregar a mídia.");
  }
}
