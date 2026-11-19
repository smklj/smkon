import { MemberControls } from "@/components/admin/MemberControls";
import { Badge } from "@/components/ui/PageHeader";
import { errorFields, log } from "@/lib/observability/log";
import { WORKSPACE_TIMEZONE } from "@/lib/publication/types";
import { createClient } from "@/lib/supabase/server";
import { listMembers } from "@/lib/tenancy/admin";
import { ROLE_LABEL, canManageMembers, memberControls, type MemberRole, type MemberRow } from "@/lib/tenancy/members";
import { findWorkspace } from "@/lib/tenancy/workspace";

type State =
  | { state: "ok"; members: MemberRow[]; viewerId: string; viewerRole: MemberRole }
  | { state: "no-workspace" }
  | { state: "forbidden" }
  | { state: "unavailable" }
  | { state: "error" };

async function load(): Promise<State> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { state: "no-workspace" };
    const workspace = await findWorkspace(supabase, user.id);
    if (!workspace) return { state: "no-workspace" };
    const result = await listMembers(supabase, workspace.organizationId);
    if (result.state !== "ok") return result;
    return { state: "ok", members: result.members, viewerId: user.id, viewerRole: workspace.role };
  } catch (error) {
    log("error", "admin.members", errorFields(error));
    return { state: "error" };
  }
}

/** Membros do workspace ativo. Owner altera papéis e remove; admin só consulta. */
export async function MembersPanel() {
  const data = await load();

  if (data.state === "error") {
    return <p className="feedback feedback-error" role="alert">Não foi possível carregar os membros agora.</p>;
  }
  if (data.state === "forbidden") {
    return <p className="muted">Apenas owner ou admin veem a lista de membros.</p>;
  }
  if (data.state === "unavailable") {
    return (
      <p className="muted">
        A lista de membros fica disponível depois que a migration <code>20261119070000_workspace_members</code> for aplicada neste ambiente.
      </p>
    );
  }
  if (data.state === "no-workspace" || data.members.length === 0) {
    return (
      <div className="empty">
        <p className="empty-title">Nenhum membro</p>
        <p>Entre no workspace para ver quem tem acesso.</p>
      </div>
    );
  }

  const ownerCount = data.members.filter((member) => member.role === "owner").length;
  const manage = canManageMembers(data.viewerRole);

  return (
    <div className="members">
      <ul className="rows" aria-label="Membros do workspace">
        {data.members.map((member) => {
          const isSelf = member.userId === data.viewerId;
          const label = member.email ?? "membro sem e-mail";
          const controls = memberControls(data.viewerRole, member, ownerCount);
          return (
            <li className="row" key={member.userId}>
              <div className="row-main">
                <p className="row-title">
                  {label}
                  {isSelf ? <span className="muted"> · você</span> : null}
                </p>
                <p className="row-meta">
                  membro desde {new Date(member.joinedAt).toLocaleDateString("pt-BR", { timeZone: WORKSPACE_TIMEZONE })}
                  {member.role === "owner" && ownerCount <= 1 ? " · único owner" : ""}
                </p>
              </div>
              <Badge>{ROLE_LABEL[member.role]}</Badge>
              {manage ? (
                <MemberControls
                  userId={member.userId}
                  label={label}
                  role={member.role}
                  isSelf={isSelf}
                  canChangeRole={controls.canChangeRole}
                  canRemove={controls.canRemove}
                />
              ) : null}
            </li>
          );
        })}
      </ul>
      {manage ? null : <p className="muted">Somente o owner altera papéis e remove membros.</p>}
    </div>
  );
}
