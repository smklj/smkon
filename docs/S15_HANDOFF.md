# S15 — Audiência e CRM com consentimento (LGPD) · handoff

**Branch:** `feature/s15-audience-consent` · **PR:** #47 (base `feature/smkon-production-readiness`)
**Plano e registro detalhado:** `docs/S15_PROGRESS.md`

## O que mudou

### Banco — `supabase/migrations/20261119110000_audience_consent.sql`
- `contacts`: dados mínimos por workspace (nome opcional, e-mail e/ou telefone E.164), origem, detalhe da origem, finalidade e base legal (consentimento, legítimo interesse, execução de contrato). Regra base × finalidade na constraint `contacts_basis_purpose`. E-mail e telefone únicos por workspace. Sem `delete`.
- `consent_events`: só inclusão. `opt_in`/`opt_out` com finalidade, canal, tipo e referência da evidência, data do fato e autor. Opt-in exige evidência; "link de descadastro" não prova opt-in. A única alteração permitida é apagar `evidence_ref` na anonimização.
- `contact_consent_state` (view `security_invoker`): estado atual derivado do histórico, pela data do fato; em empate a revogação prevalece.
- `data_subject_requests`: acesso, correção e exclusão; `due_at = received_at + 15 dias` (LGPD art. 19, II); pedido resolvido não muda.
- Exclusão = anonimização (`resolve_data_subject_request` de um pedido de exclusão, ou `anonymize_contact`, que registra um pedido interno e o conclui): revoga o que estiver ativo; apaga nome, e-mail, telefone, detalhe da origem, referências de evidência e texto dos pedidos; mantém o registro, a finalidade, a base legal e o histórico.
- Segurança: RLS por workspace (membros leem); escrita só por 8 funções `security definer` com `search_path = ''`, restritas a owner/admin. `authenticated` sem insert/update/delete diretos; `anon` sem acesso. Funções internas `audience_*` fechadas.
- Auditoria: trigger `audience_audit` grava no `audit_log` sem os campos pessoais (só os nomes dos campos alterados em `pii_fields_changed`). Exportações ficam no `audit_log` (`table_name = 'contact_exports'`).

### Servidor
- `src/lib/audience/types.ts` — enums, rótulos, regra `BASES_BY_PURPOSE` (espelha o banco), estado derivado, situação do prazo, nome do arquivo de exportação.
- `src/lib/audience/validation.ts` — validação de entrada (e-mail, telefone com +55 automático, data do fato, evidência, pedidos, confirmação `EXCLUIR`, termo de busca seguro para o PostgREST).
- `src/lib/audience/server.ts` — consultas e RPCs.
- `src/lib/audience/export.ts` + `GET /api/audience/contacts/[id]/export` — JSON do titular (`smkon.contact_export.v1`), owner/admin, `Cache-Control: no-store, private`, nome do arquivo sem dado pessoal.
- Compartilhados (mudanças aditivas): códigos de erro em `src/lib/http/errors.ts`, tipos em `src/lib/supabase/database.types.ts`, área 07 em `src/lib/navigation.ts`.

### UI — `/audiencia`
Pedidos do titular em aberto com alerta de prazo; lista com busca (nome, e-mail, telefone) e filtro de anonimizados; cadastro com consentimento inicial obrigatório para a base consentimento; detalhe com dados, correção, estado e histórico de consentimento, registrar consentimento/revogação, revogar tudo, exportar JSON, registrar e resolver pedido, exclusão com motivo e confirmação digitada. Se a migration não estiver no ambiente, mostra aviso claro. **Nenhum envio real de e-mail ou mensagem.**

## Testes (resultados reais)
- SQL (`supabase/tests/030_audience_consent.test.sql`): **76 asserções** — estrutura e permissões, papéis (viewer/analyst/admin/owner), isolamento entre workspaces, append-only (inclusive para o dono do banco), estado derivado e revogação, prazo, exportação, auditoria sem dado pessoal, anonimização e reidentificação bloqueada. Suíte completa local: **18 arquivos, 606 asserções**, todas passando. CI "Database migrations and SQL tests": verde.
- Unitários (`tests/unit/audience.test.ts`): **13 testes**; suíte **169/169**.
- `typecheck`, `lint`, `build`: sem erros (local e CI).
- E2E: `/audiencia` no `navigation.spec`; `tests/e2e/audience.spec.mjs` (cadastro → revogar tudo → exportação → exclusão). A primeira execução falhou por seletor ambíguo do teste (summary e botão com o mesmo texto) depois de cadastro, revogação e exportação passarem; corrigido.

## Staging
Migration aplicada em `xoyasrizivadxnpmzzno` (autorização do Owner de 19/11). MD5 das 18 funções, da view e das constraints idêntico ao banco local migrado pelo repositório. Advisors de segurança: só os avisos esperados de RPC `security definer` executável por `authenticated` (mesmo padrão dos demais módulos).

## Problemas e pendências
- **Produção:** migration `20261119110000` não aplicada — exige autorização explícita do Owner.
- A execução E2E que falhou deixou contatos fictícios (`e2e-…@smkon.test`, "Contato E2E …") não anonimizados no staging; podem ser excluídos pela própria tela.
- Fora do escopo desta frente: expurgo automático por prazo de retenção (precisa de rotina agendada), importação em lote com prova de origem, formato de portabilidade regulamentado pela ANPD, e qualquer envio real de mensagens (que deverá consultar `contact_consent_state` antes de cada envio).

## Próxima etapa recomendada
Autorizar a migration na produção; depois, ligar o estado de consentimento a qualquer canal de envio futuro (bloquear envio sem `granted` para a finalidade × canal) e criar a rotina de revisão de retenção.
