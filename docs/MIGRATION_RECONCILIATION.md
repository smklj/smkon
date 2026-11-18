# Reconciliação segura de migrations — SMKON

## Estado Git confirmado

A branch `feature/smkon-production-readiness` contém esta sequência canônica:

1. `20261117183000_split_01_revenue_domains.sql`
2. `20261117200000_content_studio.sql`
3. `20261118120000_product_intelligence.sql`
4. `20261118150000_p0_security_integrity.sql`
5. `20261118170000_hardening_rls_indexes_audit.sql`

A migration de Product Intelligence correta é `20261118120000_product_intelligence.sql`; não existe `20261118000000_product_intelligence.sql`. A migration de Product Intelligence depende do enum criado na primeira migration. A sequência não pode ser reordenada nem renomeada depois de aplicada em qualquer ambiente.

## Regra para o Supabase hospedado

O estado do histórico remoto não pode ser inferido apenas pelo diretório Git. Antes de qualquer aplicação:

1. Fazer backup verificável e registrar o project ref.
2. Obter `supabase migration list --linked` e guardar a saída.
3. Conferir o catálogo remoto e o schema real, não apenas a tabela `supabase_migrations.schema_migrations`.
4. Comparar cada timestamp local com os registros remotos e hashes/conteúdo conhecidos.
5. Se o remoto estiver vazio, mas já possuir objetos, não executar `db push` às cegas: reconciliar via baseline controlado ou restaurar um banco de desenvolvimento limpo.
6. Rodar `supabase db push --dry-run` em ambiente vinculado e revisar o plano. A execução real requer aprovação explícita do Owner.
7. Confirmar Auth, bootstrap do Owner e RLS com dois tenants após aplicar em ambiente de staging.

Não usar `migration repair` para simplesmente silenciar divergências. Não renomear migrations já aplicadas. Nenhuma etapa deste documento aplica alterações ao projeto hospedado.
