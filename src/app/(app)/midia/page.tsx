import type { Metadata } from "next";
import { Badge, PageHeader, SectionHeading } from "@/components/ui/PageHeader";
import { LicenseForm } from "@/components/media/LicenseForm";
import { MediaUpload } from "@/components/media/MediaUpload";
import { Pager, pageHref } from "@/components/ui/Pager";
import { ArchiveMedia, RevokeLicense } from "@/components/media/RevokeLicense";
import { listMedia, type MediaWithLicenses } from "@/lib/media/repository";
import {
  formatBytes,
  LICENSE_STATUS_LABEL,
  LICENSE_STATUS_TONE,
  LICENSE_TYPE_LABEL,
  licenseStatus,
  todayInBrazil,
} from "@/lib/media/types";
import { errorFields, log } from "@/lib/observability/log";
import { InvalidCursorError } from "@/lib/pagination/keyset";
import { createClient } from "@/lib/supabase/server";
import { canEditContent, findWorkspace, type Workspace } from "@/lib/tenancy/service";

export const metadata: Metadata = { title: "Mídia e licenças" };

type Data =
  | { state: "no-workspace" }
  | { state: "error" }
  | { state: "ok"; workspace: Workspace; media: MediaWithLicenses[]; nextCursor: string | null; cursorReset: boolean };

async function load(cursor: string | null): Promise<Data> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { state: "no-workspace" };
    const workspace = await findWorkspace(supabase, user.id);
    if (!workspace) return { state: "no-workspace" };
    try {
      const page = await listMedia(supabase, workspace.organizationId, { signUrls: true, cursor });
      return { state: "ok", workspace, media: page.items, nextCursor: page.nextCursor, cursorReset: false };
    } catch (error) {
      if (!(error instanceof InvalidCursorError)) throw error;
      const page = await listMedia(supabase, workspace.organizationId, { signUrls: true });
      return { state: "ok", workspace, media: page.items, nextCursor: page.nextCursor, cursorReset: true };
    }
  } catch (error) {
    log("error", "page.midia", errorFields(error));
    return { state: "error" };
  }
}

function formatDate(value: string): string {
  const [year, month, day] = value.slice(0, 10).split("-");
  return `${day}/${month}/${year}`;
}

export default async function MediaPage({ searchParams }: { searchParams: Promise<{ cursor?: string }> }) {
  const params = await searchParams;
  const cursor = typeof params.cursor === "string" ? params.cursor : null;
  const data = await load(cursor);
  const today = todayInBrazil();
  const canEdit = data.state === "ok" && canEditContent(data.workspace.role);

  return (
    <div className="page">
      <PageHeader
        eyebrow="06 · Jurídico"
        title="Mídia e licenças"
        description="Arquivos privados do workspace e o registro de direitos de uso. A fila de publicação só aprova peças com mídia licenciada para uso comercial na data agendada."
      />

      {data.state === "error" ? <p className="feedback feedback-error" role="alert">Não foi possível carregar a biblioteca agora.</p> : null}

      {canEdit && data.state === "ok" ? (
        <section className="panel" aria-labelledby="enviar-titulo">
          <SectionHeading id="enviar-titulo" title="Enviar arquivo" />
          <MediaUpload organizationId={data.workspace.organizationId} />
        </section>
      ) : null}

      <section className="panel" aria-labelledby="biblioteca-titulo">
        <SectionHeading id="biblioteca-titulo" title="Biblioteca" />
        {data.state === "ok" && data.cursorReset ? (
          <p className="feedback feedback-info" role="status">O link de paginação expirou. Mostrando a primeira página.</p>
        ) : null}
        {data.state === "no-workspace" ? (
          <div className="empty"><p className="empty-title">Workspace ainda não criado</p><p>Ele é criado no primeiro login.</p></div>
        ) : data.state === "ok" && data.media.length === 0 && !cursor ? (
          <div className="empty"><p className="empty-title">Nenhum arquivo</p><p>Envie o vídeo ou a imagem da peça e registre a licença.</p></div>
        ) : data.state === "ok" ? (
          <ul className="rows">
            {data.media.map((asset) => {
              const status = licenseStatus(asset.licenses, today);
              return (
                <li className="row row-top" key={asset.id}>
                  <div className="row-main">
                    <p className="row-title">{asset.original_name}</p>
                    <p className="row-meta">
                      {asset.kind === "video" ? "Vídeo" : "Imagem"} · {formatBytes(asset.size_bytes)} · enviado em {formatDate(asset.created_at)}
                      {asset.signedUrl ? <> · <a className="link" href={asset.signedUrl} target="_blank" rel="noopener noreferrer">Abrir</a></> : null}
                    </p>
                    {asset.licenses.length ? (
                      <ul className="reasons">
                        {asset.licenses.map((license) => (
                          <li key={license.id}>
                            {LICENSE_TYPE_LABEL[license.license_type]} · {license.licensor} · {formatDate(license.valid_from)}
                            {license.valid_until ? ` até ${formatDate(license.valid_until)}` : " sem prazo final"} · {license.territory}
                            {license.allows_commercial_use ? " · uso comercial" : " · sem uso comercial"}
                            {license.proof_url ? <> · <a className="link" href={license.proof_url} target="_blank" rel="noopener noreferrer nofollow">comprovação</a></> : null}
                            {license.revoked_at ? <span className="muted"> · revogada: {license.revoke_reason}</span> : null}
                            {canEdit && !license.revoked_at ? <RevokeLicense licenseId={license.id} /> : null}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    {canEdit ? <LicenseForm mediaId={asset.id} mediaName={asset.original_name} today={today} /> : null}
                  </div>
                  <div className="evidence-review">
                    <Badge tone={LICENSE_STATUS_TONE[status]}>{LICENSE_STATUS_LABEL[status]}</Badge>
                    {canEdit ? <ArchiveMedia mediaId={asset.id} mediaName={asset.original_name} /> : null}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : null}
        {data.state === "ok" ? (
          <Pager
            shown={data.media.length}
            nextHref={data.nextCursor ? pageHref("/midia", { cursor: data.nextCursor }) : null}
            firstHref={cursor && !data.cursorReset ? pageHref("/midia", {}) : null}
          />
        ) : null}
      </section>
    </div>
  );
}
