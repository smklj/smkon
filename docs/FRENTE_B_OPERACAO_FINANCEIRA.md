# Frente B — Operação Financeira

**Escopo oficial:** S8 e S11  
**Responsabilidade:** ciclo de vida financeiro, ingestão de dados de provedores, normalização e conciliação.  
**Responsável de execução neste plano:** GPT/Codex.  
**Estado do documento:** baseline de trabalho; não equivale a declaração de conclusão funcional.

## 1. Objetivo

Construir uma operação financeira rastreável e reconciliável, distinguindo vendas, comissões, liquidações, pagamentos, cancelamentos, estornos, taxas e ajustes. Toda informação deve manter origem, moeda, identificador externo, timestamps e evidência do provedor.

## 2. Escopo

### S8 — Ciclo de vida das comissões

Estados documentados:
- `pending`: prevista;
- `approved`: aprovada;
- `settled`: liquidada;
- `paid`: paga;
- `cancelled`: cancelada;
- `reversed`: estornada.

Transições documentadas:
- prevista → aprovada ou cancelada;
- aprovada → liquidada ou estornada;
- liquidada → paga ou estornada;
- paga → estornada;
- cancelada e estornada são estados finais.

Requisitos:
- rejeitar transições inválidas;
- manter histórico append-only;
- preservar imutabilidade de identidade, tenant, moeda e valores-base após os pontos definidos pelo domínio;
- gerar lançamentos no ledger de forma idempotente;
- distinguir comissão prevista, aprovada, liquidada e efetivamente paga;
- apresentar totais por estado e moeda sem violar RLS.

**Estado de referência:** `docs/S8_HANDOFF.md` registra a migration `20261118200000_commission_lifecycle.sql`, histórico, ledger, view de resumo e UI financeira como implementados/testados no registro de 18/11/2026. O roadmap registra S8 em produção. A ingestão real e conciliação permanecem atribuídas ao S11.

### S11 — Primeiro conector financeiro real

**Provedor escolhido no handoff:** Mercado Livre.  
**Modo inicial:** leitura e dry-run; staging; nenhuma mutação de anúncios, pedidos ou conta.  
**Produção e contas reais:** fora do escopo sem autorização separada.

Objetivo:
- conectar uma conta de teste/autorizada por OAuth seguro;
- importar dados disponíveis de pedidos e pagamentos;
- normalizar eventos para o domínio financeiro;
- persistir snapshots/eventos sem PII desnecessária;
- reconciliar valores e estados com a origem;
- impedir duplicação em reprocessamento.

O handoff S11 registra implementação parcial do adapter, OAuth e persistência server-side, snapshots PII-free e idempotência na branch de integração. Também registra limitações: OAuth real não configurado/testado, importação manual limitada a uma página de até 50 pedidos, ausência de backfill/paginação histórica/checkpoint completo, reconciliação incompleta de pagamentos/taxas/frete/estornos/provisões/repasses e ausência de ledger gerado pelo conector. Portanto, **S11 permanece parcial e não operacional como integração financeira completa**.

## 3. Entregáveis

1. Máquina de estados S8 com transições validadas no banco e aplicação.
2. Histórico financeiro append-only e ledger idempotente.
3. Adapter Mercado Livre isolado do domínio canônico.
4. OAuth server-side com state one-time, PKCE conforme configuração, tokens cifrados e refresh serializado.
5. Ingestão paginada com checkpoints transacionais.
6. Mapeamento de pedidos, pagamentos, taxas, cancelamentos, reembolsos e estornos com origem explícita.
7. Relatório de conciliação por período, conta, moeda e estado.
8. Procedimento de desconexão, reautorização e recuperação de falhas.

## 4. Critérios de aceite

### S8
- [ ] Toda transição válida é aceita e toda transição inválida é recusada.
- [ ] Histórico não pode ser alterado ou apagado por papéis de aplicação.
- [ ] Reprocessamento não duplica lançamentos.
- [ ] Valores, moeda e tenant permanecem consistentes.
- [ ] Totais por estado/moeda reconciliam com registros de origem.
- [ ] RLS impede leitura entre workspaces.

### S11
- [ ] OAuth rejeita state inválido, expirado ou reutilizado.
- [ ] Tokens nunca aparecem no browser, logs ou tabelas acessíveis a papéis browser.
- [ ] Refresh concorrente é serializado e grava o novo par atomicamente.
- [ ] Paginação/checkpoint não perde nem duplica eventos.
- [ ] Reexecutar a mesma janela produz zero duplicatas.
- [ ] Eventos fora de ordem preservam estado correto.
- [ ] Valores financeiros não são inferidos sem evidência explícita do provedor.
- [ ] Relatório de conciliação explica divergências, não as oculta.
- [ ] Testes de isolamento com dois workspaces passam.
- [ ] CI e E2E passam no head candidato.
- [ ] Nenhuma conexão real, secret, migration remota ou operação de produção sem autorização.

## 5. Contratos com outras frentes

- **Frente A:** depende de tenancy, RBAC, tipos, repositories, RLS e logging. Solicita mudanças nesses contratos por PR coordenado; não cria sistema paralelo de autorização.
- **Frente C:** pode fornecer infraestrutura de jobs/filas, mas S11 mantém domínio financeiro e adapter do provedor. Executor não pode criar ou alterar lançamentos financeiros sem regras e aprovações explícitas.
- Mudanças em schema compartilhado precisam de revisão de impacto nas três frentes.

## 6. Fora do escopo

- Arquitetura genérica de tenancy/RBAC (Frente A).
- Executor e integrações não financeiras S14/S17/S18/S19 (Frente C).
- Publicação, alteração de anúncios, campanhas ou movimentação de dinheiro.
- Conectar contas reais ou habilitar sincronização recorrente sem aprovação do Owner.

## 7. Riscos prioritários

- Confundir pedido concluído com pagamento liquidado.
- Tratar comissão estimada como valor recebido.
- Reprocessamento duplicar ledger ou snapshots.
- Eventos fora de ordem regredirem estados.
- Perda de checkpoint em falha parcial.
- Tokens expostos ou refresh concorrente invalidar credenciais.
- Divergência entre histórico de migrations Git e Supabase remoto.
- S11 ser anunciado como pronto apesar das limitações documentadas.

## 8. Plano de execução

1. Revalidar S8 no código atual, migrations e ambiente; não presumir que o estado histórico permanece igual.
2. Auditar a branch de integração e PRs S11, sem mesclar a branch divergente inteira em `main`.
3. Fechar lacunas de paginação, checkpoints, reconciliação e ledger com fixtures sanitizadas.
4. Executar testes unitários, SQL rollback-only, typecheck, lint, build e E2E.
5. Validar Preview e staging com dados de teste autorizados.
6. Registrar evidências e limitações no handoff.
7. Solicitar aprovação antes de conectar conta real, configurar secrets, aplicar migrations remotas ou promover produção.

## 9. Fontes internas

- `docs/S8_HANDOFF.md`
- `docs/S11_HANDOFF.md`
- `docs/ROADMAP_SPLITS.md`
- Migrations S8 e S11 correspondentes em `supabase/migrations/`

**Status geral:** S8 tem implementação documentada e consta como produção no roadmap; S11 tem implementação parcial validada em staging/CI na branch de integração, mas falta operação real e conciliação completa.
