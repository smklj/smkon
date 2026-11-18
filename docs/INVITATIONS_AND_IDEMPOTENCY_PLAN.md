# Convites e ingestão idempotente — contrato técnico

Este documento define o que falta antes de considerar a operação multi-tenant e comercial pronta. Ainda não cria conexões externas ou convida usuários.

## Convites de workspace

- Apenas `owner` e `admin` podem convidar membros.
- E-mail deve ser normalizado com trim + lowercase e validado antes da criação.
- O convite deve ser escopado a um workspace, papel permitido e expiração explícita.
- Não permitir convite com papel `owner`; transferência de ownership deve ser fluxo separado, com reautenticação.
- Nunca aceitar `organization_id`, role ou invited_by confiados apenas no corpo do cliente; obtê-los da sessão e validar membership no servidor.
- Um convite pendente para o mesmo workspace/e-mail deve ser idempotente: retornar o convite existente sem gerar tokens adicionais, ou substituir somente após revogação/expiração.
- Tokens devem ser aleatórios, armazenados como hash, de uso único e expiração curta. Nunca gravar token em logs.
- Aceitação requer sessão autenticada cujo e-mail verificado corresponda ao e-mail convidado.
- Não revelar se um e-mail existe no sistema em endpoints públicos.
- Registrar criação, revogação, expiração e aceite na auditoria.
- Testes: sem sessão; membro sem permissão; papel inválido; outro tenant; e-mail divergente; token expirado; replay; reenvio duplicado; revogação; concorrência.

## Ingestão comercial idempotente

- Cada evento deve carregar `organization_id`, provedor, conta/conexão, ID externo, tipo de evento e hash do payload normalizado.
- A chave idempotente recomendada é `(organization_id, provider, external_account_id, external_id, event_type)`, com constraint UNIQUE no banco.
- Inserir evento e projeções derivadas na mesma transação, com `INSERT ... ON CONFLICT` e comparação do payload hash.
- Mesmo evento + mesmo hash: responder como replay/no-op, sem duplicar ledger.
- Mesmo identificador + hash diferente: marcar conflito e exigir regra explícita de versão/correção; não sobrescrever silenciosamente.
- Persistir cursor/checkpoint por conexão somente após commit dos eventos.
- Usar outbox transacional para efeitos assíncronos; consumidores também devem ser idempotentes.
- Ledger é append-only. Correções devem criar lançamentos compensatórios, nunca editar o lançamento original.
- Normalizar moeda, timezone, escala decimal e semântica de status na camada de provider adapter.
- Não considerar webhooks como fonte única: suportar reconciliação periódica com API oficial.
- Testes: replay sequencial, chamadas concorrentes, payload alterado, eventos fora de ordem, retry após falha transacional, duplicação de webhook, dois tenants, rollback e reconciliação de totais.

## Critério de aceite

Não marcar como implementado até existirem migrations, handlers autenticados, autorização tenant-safe, testes de integração no PostgreSQL e evidência de teste end-to-end em ambiente isolado. Nenhum convite ou integração real é criado por esta especificação.
