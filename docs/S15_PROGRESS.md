# S15 — Audiência e CRM com consentimento (LGPD) · progresso

Branch: `feature/s15-*` · Migrations: `20261119110000`–`20261119119999` · Testes SQL: `supabase/tests/030_*`–`039_*`.

## Checklist

- [x] 1. Plano (este arquivo): modelo mínimo, bases legais, finalidades, retenção, direitos do titular.
- [ ] 2. Banco: `contacts`, `consent_events`, estado derivado, `data_subject_requests`, anonimização, RLS, funções com papéis, auditoria sem dado pessoal, testes SQL.
- [ ] 3. Servidor: `src/lib/audience/*` (validação, consultas, exportação JSON) com testes unitários.
- [ ] 4. UI `/audiencia` no app shell (lista com busca, cadastro, histórico, revogar, exportar, pedido do titular, exclusão com confirmação). Sem envio real de mensagens.
- [ ] 5. Handoff `docs/S15_HANDOFF.md` + linha do S15 no ROADMAP.

## Plano

### Princípios

- **Minimização (LGPD art. 6º, III):** só o necessário para contatar a pessoa e provar a base legal. Nada de CPF, endereço, data de nascimento, gênero, campos livres de "observações" ou dados sensíveis (art. 5º, II). Nenhum dado sensível é coletado.
- **Prova (art. 8º, §2º):** o ônus de provar o consentimento é do controlador. Cada opt-in tem finalidade, canal, tipo de evidência, referência da evidência, data do fato e quem registrou.
- **Histórico imutável:** eventos de consentimento são só de inclusão. Revogar é registrar um `opt_out` novo, nunca apagar o `opt_in`.
- **Exclusão = anonimização:** os dados pessoais saem; ficam o registro (id, origem, finalidade, base legal, datas) e o histórico de consentimento sem dado pessoal, para auditoria.
- **Nenhum envio real:** o módulo não envia e-mail, SMS, WhatsApp nem DM. Ele só registra e mostra o estado.

### Modelo de dados

`contacts` (por workspace)
- `display_name` (opcional, até 120), `email` (minúsculo, único por workspace), `phone` (E.164, único por workspace). Pelo menos e-mail ou telefone enquanto não anonimizado.
- `source`: `manual`, `form`, `event`, `purchase`, `social`, `import`; `source_detail` (até 200, referência não pessoal: nome do formulário, evento).
- `purpose` (finalidade principal) e `legal_basis` (base legal da manutenção do cadastro).
- `created_by/at`, `updated_by/at`, `last_activity_at`, `anonymized_at/by`.
- Escrita só por funções `security definer` (owner/admin). Sem `delete`.

`consent_events` (só inclusão)
- `action`: `opt_in` | `opt_out` (revogação), `purpose`, `channel` (`email`, `whatsapp`, `sms`, `phone`, `social_dm`).
- `evidence_type`: `form_checkbox`, `double_opt_in`, `written`, `recorded_call`, `unsubscribe_link`, `titular_request`, `import`; `evidence_ref` (até 500; obrigatório no opt-in). Única mudança permitida depois: apagar `evidence_ref` na anonimização (feita só pela função).
- `occurred_at` (data do fato, até 5 anos para trás, não no futuro), `recorded_by`, `created_at`.

`contact_consent_state` (view `security_invoker`): último evento por contato × finalidade × canal → `granted` verdadeiro/falso. Nunca armazenado, sempre derivado do histórico.

`data_subject_requests`
- `kind`: `access` (confirmação e cópia, inclui exportação JSON), `correction`, `deletion`.
- `received_via`: `email`, `form`, `phone`, `in_person`, `internal`; `details` (até 1000).
- `received_at`, `due_at = received_at + 15 dias`, `status`: `open` → `completed` | `rejected` (com nota), `resolved_by/at`.
- Concluir um pedido de `deletion` anonimiza o contato na mesma transação.

### Bases legais (art. 7º) e finalidades

| Finalidade | Uso | Bases aceitas |
|---|---|---|
| `marketing` | Ofertas e campanhas | consentimento, legítimo interesse (com opt-out fácil) |
| `newsletter` | Conteúdo periódico | consentimento, legítimo interesse |
| `customer_service` | Responder dúvidas e suporte | execução de contrato, legítimo interesse |
| `order_fulfillment` | Pedido, entrega, garantia | execução de contrato |
| `research` | Pesquisa de satisfação/produto | consentimento |

Regras no banco: `order_fulfillment` exige `contract`; `research` exige `consent`; `contract` só com `order_fulfillment` ou `customer_service`. Cadastro com base `consent` exige um opt-in inicial com evidência no mesmo ato.

### Retenção

- Consentimento/legítimo interesse: revisar 24 meses depois da última atividade (`last_activity_at`) ou logo após revogação total; o caminho é anonimizar.
- Execução de contrato: manter enquanto durar a relação e o prazo legal de guarda (Código de Defesa do Consumidor / obrigações fiscais), depois anonimizar.
- Histórico de consentimento e pedidos do titular: mantidos sem dado pessoal como prova (art. 16, I e art. 37).
- Expurgo automático por prazo: **fora do escopo desta frente** (exige rotina agendada); a UI mostra a última atividade para revisão manual.

### Direitos do titular (art. 18) cobertos

- Confirmação e acesso (I, II) → pedido `access` + exportação JSON do titular.
- Correção (III) → pedido `correction` + edição pelo owner/admin.
- Eliminação (VI) → pedido `deletion` → anonimização.
- Revogação do consentimento (IX) → `opt_out` por finalidade/canal ou de tudo.
- Portabilidade (V): a exportação JSON é a base; o formato regulamentado pela ANPD fica como pendência.
- Prazo: 15 dias (art. 19, II), com alerta de atraso na UI.

### Segurança

- RLS por workspace; membros leem; só owner/admin escrevem, sempre por função `security definer` com `search_path = ''`.
- `anon` sem acesso. Sem `insert/update/delete` direto para `authenticated`.
- Auditoria (`audit_log`) com trigger próprio que **remove os campos pessoais** (`display_name`, `email`, `phone`, `evidence_ref`, `details`, `resolution_note`) e registra só os nomes dos campos alterados. Exportações também entram no `audit_log`.

## Registro de execução

- 19/11/2026 13h UTC — plano criado; branch `feature/s15-audience-consent`.
