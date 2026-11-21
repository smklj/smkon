-- S11: cover the child-side foreign keys used by cleanup and tenant checks.
-- These indexes are additive; they do not change row semantics or access policies.
create index if not exists ml_credentials_conn_org_domain_fk_idx
  on public.mercado_livre_credentials (connection_id, organization_id, domain);

create index if not exists ml_oauth_conn_org_domain_fk_idx
  on public.mercado_livre_oauth_attempts (connection_id, organization_id, domain);

create index if not exists ml_oauth_created_by_fk_idx
  on public.mercado_livre_oauth_attempts (created_by);

create index if not exists ml_oauth_org_fk_idx
  on public.mercado_livre_oauth_attempts (organization_id);
