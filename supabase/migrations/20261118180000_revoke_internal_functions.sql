-- SMKON: funções internas fora da API.
-- content_canonical_hash() é usada só pelos triggers de versionamento; reject_mutation() é
-- função de trigger. Nenhuma das duas precisa ser chamável via /rest/v1/rpc.
-- Os triggers continuam funcionando: execução de trigger não depende de EXECUTE do papel.

revoke all on function public.content_canonical_hash(public.content_items) from public, anon, authenticated;
revoke all on function public.reject_mutation() from public, anon, authenticated;
