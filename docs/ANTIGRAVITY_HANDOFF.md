# SMKON — Dossiê técnico e handoff para Antigravity

**Data de referência:** 17/11/2026  
**Repositório:** https://github.com/smklj/smkon  
**Branch incluída neste pacote:** `feature/content-growth-studio-mvp`  
**Pull Request:** https://github.com/smklj/smkon/pull/3  
**Objetivo deste documento:** dar ao Antigravity contexto suficiente para auditar o projeto, entender o que existe de verdade, identificar riscos e continuar o desenvolvimento sem sobrescrever trabalho válido.

> **Regra de leitura:** separar sempre IMPLEMENTADO, DOCUMENTADO/PLANEJADO e NÃO VALIDADO. Uma tela, migration ou credencial configurada não prova que um fluxo externo está operacional.

---

## 1. Visão do produto

SMKON é um Control Center para uma operação de social commerce e curadoria de produtos. A plataforma pretende reunir inteligência de produtos, conteúdo, direitos de uso, distribuição, crescimento, financeiro e automações com IA.

Princípios:
- Evidência antes de alegações e utilidade antes de comissão.
- Conteúdo só pode ser distribuído após aprovação da versão exata, validação de direitos e disclosure aplicável.
- Gastos, campanhas pagas, compras, assinaturas e contratações exigem autorização explícita do Owner.
- Segredos não entram no Git, frontend, logs ou documentação.
- Menor privilégio, RLS, auditoria, idempotência e retries limitados.
- Usar APIs oficiais, respeitar termos, rate limits e elegibilidade.

## 2. Arquitetura funcional-alvo

O documento mestre define oito áreas operacionais:

1. **Estratégia e gestão:** roadmap, metas, indicadores, decisões e governança.
2. **Inteligência de produtos:** catálogo, pesquisa, fontes, preços, avaliações, riscos e scoring com evidências.
3. **Conteúdo e distribuição:** ideia, pesquisa, roteiro, produção, revisão, direitos, aprovação, agendamento, publicação e métricas.
4. **IA e agentes:** agentes, Planner/Executor/Verifier, ferramentas allowlist, limites, avaliações, logs, custos e kill switch.
5. **Financeiro:** ledger, receitas, custos, comissões, conciliação e relatórios.
6. **Jurídico e conformidade:** políticas de plataforma, direitos autorais, licenças, disclosures, privacidade e consentimentos.
7. **Audiência e relacionamento:** canais, comunidade, feedback, atendimento, parcerias e CRM.
8. **Segurança e infraestrutura:** GitHub, Vercel, Supabase, Auth, OAuth, RLS, segredos, CI/CD, observabilidade e backups.

### Três domínios financeiros

Os três splits são subdivisões do Financeiro, não substituem as oito áreas:

- **Mídia e anúncios:** Meta Ads, Google Ads e GA4; investimento é custo de aquisição, não receita.
- **Vendas próprias:** Mercado Livre, TikTok Shop Seller e Shopify, conforme operação e elegibilidade.
- **Afiliados e comissões:** Shopee, Amazon Associados/Creators e TikTok Shop Affiliate, conforme elegibilidade.

Não misturar pedido, pagamento, liquidação, comissão prevista, comissão aprovada e comissão paga. Deduplicar eventos externos e manter moeda/origem.

## 3. O que já existe no código desta branch

### 3.1 Fundação de aplicação
- Next.js App Router.
- TypeScript.
- React.
- Estrutura inicial do Control Center.
- Configuração de lint, typecheck e build.
- Exemplo de variáveis de ambiente em `.env.example`.
- Cliente Supabase para browser e servidor.
- Proxy de sessão/refresh para Supabase SSR.
- Fluxo de login, criação de conta e callback PKCE presentes na fundação desta branch.
- CI no GitHub Actions com etapas de instalação, auditoria de dependências, typecheck, lint e build.

### 3.2 Segurança e multi-tenant
- Fundação SQL para separar domínios de receita.
- Organizações e membros com papéis.
- Políticas RLS e verificações estruturais/isolamento por tenant no conjunto de testes SQL.
- A migration de fundação e a migration de Content Studio estão versionadas no Git.
- **Atenção:** não considerar essas migrations aplicadas no projeto Supabase hospedado sem confirmação explícita e verificação do histórico de migrations.

### 3.3 Control Center e domínios
- Interface inicial do Control Center e separação conceitual dos três domínios de receita.
- Documentação de arquitetura das oito áreas.
- Documento mestre dos splits e regras de consolidação.
- Regras para distinguir custo de mídia, venda própria e comissão de afiliado.

### 3.4 Content Studio — PR #3
Arquivos principais:
- `src/app/studio/page.tsx`
- `src/app/studio/studio-client.tsx`
- `src/app/api/content/route.ts`
- `supabase/migrations/20261117200000_content_studio.sql`
- `.github/workflows/ci.yml`

Recursos da interface atualmente implementados:
- Briefing com título, produto, link do produto e vídeo de referência.
- Campo de confirmação de autorização/licença para vídeo de terceiros.
- Seleção de YouTube, Instagram e TikTok.
- Campos de roteiro, legenda, CTA e hashtags.
- Rascunhos, edição, exclusão e filtros por status.
- Prévia de legenda por canal e ação de copiar texto.
- Persistência atual dos rascunhos em localStorage do navegador.

API adicionada como base para a próxima integração:
- GET, POST, PATCH e DELETE autenticados em `/api/content`.
- Busca/criação de workspace organizacional.
- Operações de conteúdo limitadas ao workspace do usuário.
- Migration `content_items` com RLS para leitura por membros e escrita por owners/admins.

**Limite crítico:** a UI ainda não consome a API CRUD. O Content Studio ainda salva localmente no navegador. A API e a migration são fundação, não sincronização cloud já validada. O fluxo ponta a ponta ainda precisa de integração e teste.

### 3.5 Estado de PRs e branches conhecido
- PR #1: https://github.com/smklj/smkon/pull/1 — split de domínios de receita; branch `feature/revenue-stream-split`.
- PR #2: https://github.com/smklj/smkon/pull/2 — fundação de segurança, tenant e Supabase SSR; branch `fix/sprint-1-security-auth-foundation`.
- PR #3: https://github.com/smklj/smkon/pull/3 — Content Studio MVP; branch `feature/content-growth-studio-mvp`, draft e aberta na última consulta.
- PR #3 tem como base a branch `fix/sprint-1-security-auth-foundation`, não `main`.
- Não assumir que os PRs estão mesclados. Verificar estado atual no GitHub antes de atuar.

## 4. Stack técnica identificada

Conforme `package.json` da branch:
- Next.js 16.4.6
- React 19.2.1 / React DOM 19.2.1
- TypeScript 5.9.3
- Supabase JS 2.119.0
- Supabase SSR 0.12.7
- ESLint 9.39.1
- Node.js 22 no workflow CI

Scripts:
- `npm run dev`
- `npm run typecheck`
- `npm run lint`
- `npm run build`

## 5. Plugins, conectores e serviços — o que é o quê

Esta seção distingue conectores usados no trabalho, conectores com projeto/conta identificados e integrações externas apenas planejadas. **A disponibilidade de um conector no ChatGPT não significa que ele esteja integrado ao produto SMKON.**

### 5.1 Conectores diretamente relevantes e identificados

| Serviço | Papel no SMKON | Estado verificado / ressalva |
|---|---|---|
| GitHub | Repositório, branches, commits, PRs e CI | Conector GitHub foi usado para ler e alterar o repositório `smklj/smkon`. |
| Supabase | PostgreSQL, Auth, RLS, Storage e migrations | Projeto `smkonlj`, ref `hpplboyysmfcjsnjrdmw`, status reportado `ACTIVE_HEALTHY`. Migrations recentes desta branch não devem ser presumidas aplicadas. |
| Vercel | Hosting, previews e deploys | Projeto `smkon` já foi identificado no histórico do projeto. Confirmar vínculo Git, ambiente, deployments e variáveis no painel antes de considerar CI/CD operacional. |

### 5.2 Conectores/ferramentas disponíveis no ambiente ChatGPT

O ambiente de trabalho disponibiliza conectores/ferramentas para:
- GitHub
- Supabase
- Vercel
- Notion
- Dropbox
- Gmail
- Google Calendar
- Adobe / Acrobat
- Canva
- Metricool
- Supermetrics
- Shopify
- OpenSEO
- Similarweb
- vidIQ
- Indeed Job Search
- Resend
- Figma
- Runway

**Importante:** esta é uma lista de ferramentas disponíveis no ambiente de assistência, não uma declaração de que todas estão conectadas ao SMKON, autenticadas na conta certa, ou implementadas no código. Não adicionar dependência de nenhum conector ao runtime do SMKON sem decisão de arquitetura, credenciais próprias, OAuth/escopos, segurança e teste.

### 5.3 Metricool e Supermetrics — referência de arquitetura anterior

A documentação arquitetural existente registra:
- Metricool como ferramenta considerada para gestão/publicação de perfis sociais.
- Supermetrics como fonte de dados/analytics de Instagram Insights, TikTok Organic e Pinterest; YouTube ainda exigia validação.
- Meta Ads e Amazon Ads apareciam como não autenticados no snapshot documentado.

Esse registro é contexto histórico/documental. O estado atual de autenticação, escopos, sincronização e publicação deve ser revalidado diretamente nos respectivos conectores. Não declarar esses fluxos operacionais sem teste end-to-end.

### 5.4 Plataformas de negócio planejadas — não confundir com conectores já integrados

- Meta Ads, Google Ads e GA4.
- Mercado Livre.
- TikTok Shop Seller e TikTok Shop Affiliate (fluxos separados).
- Amazon Associados/Creators e Amazon Seller Central (programas/fluxos diferentes).
- Shopee.
- Shopify.

As plataformas acima fazem parte do mapa de integrações desejadas; não há evidência neste repositório de OAuth e sincronização de produção concluídos.

## 6. Infraestrutura e ambiente

### Supabase
- Projeto identificado: `hpplboyysmfcjsnjrdmw`.
- Região reportada: `us-west-2`.
- Status reportado: `ACTIVE_HEALTHY`.
- Variáveis esperadas no Preview:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
  - `NEXT_PUBLIC_SITE_URL`
- Segredo server-side `SUPABASE_SECRET_KEY` nunca deve usar prefixo `NEXT_PUBLIC_` e nunca deve ser exposto ao browser.
- Confirmar migrations aplicadas, Auth providers, redirect URLs, RLS e tabelas diretamente no projeto antes de testar.

### Vercel
- Projeto identificado como `smkon`.
- Confirmar team/account correto, repositório vinculado, branch de produção, Preview deployments, variáveis e proteção de deploy.
- Não promover nem fazer deploy de produção sem autorização explícita.

### GitHub
- Repositório: `https://github.com/smklj/smkon`.
- Branch do pacote: `feature/content-growth-studio-mvp`.
- Workflow: `.github/workflows/ci.yml`.
- Verificar o status atual do CI e os checks do PR #3 antes de alterar a branch.

## 7. O que ainda NÃO está pronto

1. Content Studio conectado à API e com persistência real no Supabase.
2. Aplicação e validação das migrations em ambiente isolado/autorizado.
3. Testes end-to-end de signup, login, refresh, workspace e RLS com dois tenants.
4. Upload e biblioteca de mídia com storage seguro.
5. Editor de vídeo real: timeline, cortes, trilhas, legendas, templates, renderização e exportação.
6. OAuth e conexões oficiais de cada plataforma social.
7. Publicação/agendamento com confirmação de versão, direitos, disclosure, idempotência e logs.
8. Integrações financeiras reais e reconciliação com dados de origem.
9. Agentes IA com allowlist, Planner/Executor/Verifier, limites, auditoria e kill switch.
10. Observabilidade, alertas, backups e testes completos de segurança.
11. CI verde confirmado na versão mais recente — conferir no GitHub, não assumir.

## 8. Riscos técnicos para auditoria do Antigravity

Solicitar que o Antigravity verifique, sem fazer deploy:
- Se a migration de tenants e a migration de Content Studio são compatíveis e executáveis na ordem correta.
- Se policies RLS permitem bootstrap inicial do workspace sem escalada de privilégio.
- Se criação simultânea de workspace pode gerar corrida/duplicidade.
- Se API retorna status HTTP corretos para validação, autenticação e falhas de banco.
- Se PATCH exige payload completo e se UI deverá enviar todos os campos.
- Se DELETE/PATCH verificam existência do registro e retornam 404 quando aplicável.
- Se URLs são validadas como HTTPS e têm limites adequados.
- Se a UI pode migrar de localStorage para API sem perda, duplicação ou sobrescrita de rascunhos.
- Se dados de localStorage são validados antes de serem carregados.
- Se existe tratamento de erro, loading, estado offline e retry seguro.
- Se o pipeline de CI realmente executa nas branches/PRs relevantes.
- Se dependências têm advisories conhecidos; não usar `npm audit fix --force` sem análise de breaking changes.
- Se o README da branch reflete o estado atual (o README da main ainda pode estar desatualizado).
- Se as rotas protegidas realmente exigem Auth quando as variáveis Supabase estão configuradas.
- Se nenhum segredo foi incluído no Git, build, logs ou documentação.

## 9. Prompt de trabalho recomendado para o Antigravity

Você está assumindo a continuidade técnica do projeto SMKON. Antes de alterar qualquer arquivo:

1. Leia este dossiê inteiro e todos os documentos em `docs/architecture/`.
2. Inspecione o código completo, migrations, testes SQL, workflow CI, branches e PRs.
3. Faça um diagnóstico independente do estado real: implementado, parcialmente implementado, planejado, quebrado e não validado.
4. Não confie apenas em comentários ou documentação; compare cada afirmação com o código.
5. Preserve a arquitetura das oito áreas e os três domínios financeiros separados.
6. Preserve Next.js App Router + TypeScript + Supabase SSR, PostgreSQL e RLS, salvo justificativa técnica documentada.
7. Priorize corrigir a fundação, testes e persistência do Content Studio antes de iniciar integrações externas.
8. Produza um plano de execução por fases, com arquivos afetados, dependências, critérios de aceite e testes.
9. Depois da auditoria, implemente em blocos coerentes e mantenha commits pequenos e rastreáveis.
10. Não use dados fictícios como se fossem reais. Não simule conexão, publicação, OAuth ou sincronização.
11. Não faça deploy de produção, não mescle na `main`, não aplique migrations no Supabase hospedado, não altere DNS/variáveis de produção e não crie serviços pagos sem autorização explícita.
12. Nunca publique conteúdo sem aprovação explícita da versão exata e validação dos direitos/disclosure.

### Primeira entrega obrigatória do Antigravity
- Relatório de auditoria do código e arquitetura.
- Matriz de funcionalidades com status real.
- Lista priorizada de bugs/riscos.
- Plano técnico para tornar o Content Studio cloud-persistent.
- Plano de testes (unitários, integração, RLS multi-tenant e E2E).
- Estimativa de esforço por fase.
- Só depois iniciar mudanças de grande porte.

## 10. Como executar localmente

Requisitos: Node.js 22 e npm.

```bash
npm install
cp .env.example .env.local
# preencher somente com variáveis do ambiente de desenvolvimento/Preview autorizado
npm run dev
```

Validação:

```bash
npm run typecheck
npm run lint
npm run build
```

Não incluir `.env.local`, tokens, chaves, cookies, exports de banco ou dados pessoais no pacote compartilhado.

## 11. Regras de governança para quem continuar o projeto

- Trabalhar primeiro em branch de feature.
- Abrir PR para revisão; não alterar `main` diretamente.
- Não fazer merge nem deploy de produção sem autorização do Owner.
- Não aplicar migration hospedada sem aprovação explícita.
- Não criar projetos/serviços pagos ou gastos.
- Nunca commitar secrets.
- Publicação exige aprovação humana da versão exata.
- Não usar vídeo de terceiros sem licença/autorização aplicável; crédito isolado não é licença.
- Documentar decisões e atualizar este dossiê quando o estado real mudar.

---

**Fim do handoff.** Este documento é um mapa de continuidade, não um certificado de que todas as integrações e funcionalidades estão operacionais.


## 12. Contas, identidades e acessos usados no trabalho

Esta seção registra identificadores operacionais úteis para o Antigravity localizar os recursos corretos. **Não contém senhas, tokens, cookies, chaves privadas ou refresh tokens.** O Antigravity deve pedir autenticação própria/local quando necessário; não tentar reutilizar credenciais do ChatGPT.

### 12.1 Identidade principal SMKON
- E-mail oficial de trabalho informado para a operação: **smkonlj@gmail.com**.
- Essa identidade foi usada como referência para as contas de trabalho do SMKON.
- Não confundir com a conta pessoal/primária do usuário usada em outros serviços.

### 12.2 GitHub — repositório e conta
- Conta/owner: **smklj**
- E-mail associado à conexão GitHub usada no trabalho: **smkonlj@gmail.com**
- Repositório: **https://github.com/smklj/smkon**
- Branches conhecidas: `main`, `feature/revenue-stream-split`, `fix/sprint-1-security-auth-foundation`, `feature/content-growth-studio-mvp`.
- Acesso foi concedido pelo conector GitHub do ambiente ChatGPT, que permitiu consultar repositório, arquivos, branches, commits, PRs e workflows, e gravar commits em branches autorizadas.
- Forma de trabalho: primeiro inspecionar arquivos e estrutura; criar branch de feature; fazer commits pequenos; abrir PR; acompanhar checks; revisar diffs. Não trabalhar diretamente em `main` para mudanças de funcionalidade.
- PRs de referência: #1 (separação dos domínios de receita), #2 (fundação Auth/tenant/Supabase SSR), #3 (Content Studio MVP).
- **Para o Antigravity:** conectar o GitHub por sua própria integração/autorização e abrir o repositório `smklj/smkon`. O acesso do conector ChatGPT não transfere automaticamente sessão ou credenciais para o Antigravity.

### 12.3 Supabase — organização e projeto
- Organização identificada: **Smkon** (slug/ID da organização deve ser consultado no dashboard).
- Projeto: **smkonlj**
- Project ref/ID: **hpplboyysmfcjsnjrdmw**
- Região reportada: **us-west-2**
- Banco: PostgreSQL 17.
- Estado reportado pelo conector: `ACTIVE_HEALTHY`.
- Acesso foi realizado pelo conector Supabase selecionando a organização/projeto e consultando a lista de projetos. Isso comprova que o projeto foi localizado pelo conector; não comprova que todas as migrations do Git foram aplicadas.
- A aplicação Next.js usa `@supabase/ssr` e `@supabase/supabase-js`. As variáveis previstas no código são:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
  - `NEXT_PUBLIC_SITE_URL`
  - `SUPABASE_SECRET_KEY` (somente servidor, quando realmente necessário; nunca no browser).
- O arquivo `.env.example` mostra nomes, não valores. Não copiar secrets do painel para o Antigravity nem para o Git.
- Procedimento de conexão no projeto: criar/selecionar o projeto no Supabase; obter Project URL e publishable key; configurar essas variáveis no ambiente local/Preview; habilitar Auth e redirect URLs; executar migrations apenas em ambiente de desenvolvimento/local ou após aprovação explícita do Owner para o projeto hospedado; testar RLS com usuários de dois workspaces.
- **Limite atual:** migrations de divisão de receita e Content Studio estão versionadas na branch, mas não presumir que foram aplicadas ao banco hospedado. A aplicação das migrations hospedadas exige autorização explícita.

### 12.4 Vercel — equipe e projeto
- Equipe/conta de trabalho identificada: **Smkon**, associada à identidade **smkonlj@gmail.com**.
- Projeto Vercel identificado no histórico técnico: **smkon**.
- Project ID registrado: **prj_udn2T9xYctnJU8uq4oE6wjzPF5qK**.
- O acesso foi feito pelo conector Vercel selecionando a equipe Smkon. A conexão do conector permite consultar/gerenciar recursos conforme as permissões autorizadas; não equivale a garantir deploy de produção.
- Fluxo de trabalho esperado: conectar o repositório GitHub ao projeto Vercel; configurar Preview e variáveis de ambiente; usar deploys Preview por PR; validar build e runtime; somente promover produção com aprovação explícita.
- Antes de continuar, confirmar no dashboard se o projeto está efetivamente vinculado ao repo correto e qual branch está configurada como produção. O histórico teve etapas em que a equipe existia antes do projeto estar vinculado; não inferir vínculo Git só pelo nome do projeto.
- Não incluir valores de variáveis de ambiente no dossiê.

### 12.5 Metricool — perfis sociais
O contexto de conexão registrado para o trabalho SMKON indicava uma marca/perfis no Metricool:
- Instagram: perfil/handle **smkonlj**
- TikTok: perfil/handle **smkonlj**
- Pinterest: perfil/handle **smkonlj**
- YouTube: canal identificado pelo ID **UCi4ojwzDB77Geb5ytrXqJ9w**

Como foi conectado:
1. A conta Metricool foi autorizada no ambiente de conectores.
2. A marca SMKON e os perfis/canais foram associados dentro do Metricool.
3. O conector Metricool disponibiliza operações para consultar calendário/publicações e gerenciar posts agendados.
4. Antes de publicar, o Antigravity deve verificar a conexão atual de cada canal, permissões, formatos aceitos, limites e estado do post.

**Atenção:** esse registro confirma o contexto de contas associado à configuração anterior, não uma validação atual de publicação em todos os canais. Não publicar posts de teste em perfis reais sem aprovação explícita.

### 12.6 Supermetrics — fontes de analytics
O snapshot de conexões registrado para Supermetrics indicava:
- TikTok Organic — conectado/autenticado no snapshot.
- Instagram Insights — conectado/autenticado no snapshot.
- Pinterest Organic — conectado/autenticado no snapshot.
- YouTube — pendente de validação final naquele snapshot.
- Meta Ads e Amazon Ads — não autenticados naquele registro.

Como foi conectado/trabalhado:
1. A conta Supermetrics foi autorizada no ambiente de conectores.
2. Foram selecionadas as fontes de dados que estavam autenticadas.
3. O fluxo de consulta do conector exige descoberta de fontes (`data_source_discovery`), descoberta de contas (`accounts_discovery`) e descoberta de campos (`field_discovery`) antes de consultar métricas.
4. Para consultas por conta específica, ler o contexto de negócio daquela conta antes de montar o relatório.
5. Validar datas, timezone, dimensões, métricas, filtros e reconciliação com a plataforma original.

**Atenção:** autenticado não significa que todos os relatórios foram testados nem que os dados já são gravados no banco SMKON. Supermetrics é uma fonte de dados/analytics; não tratar como sistema de publicação.

### 12.7 Notion e outros conectores disponíveis
- Notion foi identificado como conectado no ambiente de trabalho e pode conter documentação/decisões. Pesquisar o workspace antes de recriar documentos que possam já existir.
- Canva, Adobe/Acrobat, Runway, Shopify, OpenSEO, Similarweb, vidIQ, Dropbox, Gmail, Google Calendar, Resend, Figma e Indeed Job Search aparecem como conectores/ferramentas disponíveis no ambiente ChatGPT.
- Disponibilidade no ambiente ChatGPT não significa conta SMKON conectada, uso no código, credenciais transferíveis ou integração implementada. O Antigravity deve validar cada conta diretamente e só integrar o que tiver requisito funcional definido.

### 12.8 Integrações de negócio ainda a validar ou conectar
- Meta Business/Meta Ads: não considerar configurado ou autenticado sem nova verificação.
- Google Ads/GA4: planejados; validar conta, OAuth e escopos.
- Shopee: pendente no snapshot de conexão.
- TikTok Shop Seller e TikTok Shop Affiliate: pendentes; são produtos/escopos distintos.
- Mercado Livre: requer integração própria via API/OAuth oficial.
- Amazon Associados/Creators e Amazon Seller Central: programas distintos; validar elegibilidade e acesso.
- Shopify: conector disponível, mas não presumir loja SMKON integrada.

---

## 13. Como o trabalho foi conduzido até agora — passo a passo

1. **Definição da identidade e repositório:** foi escolhida a identidade oficial `smkonlj@gmail.com`, criada/identificada a conta GitHub `smklj` e definido o repositório `smklj/smkon`.
2. **Conexão de ferramentas:** os conectores foram autorizados no ambiente ChatGPT para trabalhar com GitHub, Supabase e Vercel; Metricool, Supermetrics e Notion aparecem no contexto de ferramentas/conexões do projeto.
3. **Levantamento arquitetural:** foram definidos o Control Center, as oito áreas operacionais e os três domínios financeiros separados.
4. **Fundação técnica:** foi organizada a aplicação Next.js/TypeScript, integração Supabase SSR, autenticação e base multi-tenant/RLS em branches de trabalho.
5. **Separação financeira:** foi documentada e iniciada a modelagem de mídia/anúncios, vendas próprias e afiliados/comissões, preservando conceitos contábeis distintos.
6. **Content Studio:** foi criada a rota de estúdio, editor de briefing, seleção de canais, confirmação de direitos, roteiros/legendas/CTA/hashtags e rascunhos locais.
7. **Backend inicial do conteúdo:** foi adicionada migration SQL e API CRUD autenticada como fundação, ainda sem conexão da UI à API e sem migration hospedada aplicada.
8. **Controle de qualidade:** foi criado workflow CI com typecheck, lint, build e relatório de auditoria de dependências. O Antigravity deve consultar o status atual do último workflow, não presumir aprovação.
9. **Revisão por PR:** as mudanças foram organizadas em branches e PRs para manter histórico e revisão antes de qualquer merge.
10. **Handoff:** este documento foi colocado em `docs/ANTIGRAVITY_HANDOFF.md` na branch `feature/content-growth-studio-mvp`.

### Como o Antigravity deve assumir sem perder contexto

1. Abra o repositório `https://github.com/smklj/smkon` com a conta GitHub autorizada.
2. Faça checkout/clone da branch `feature/content-growth-studio-mvp` para inspecionar o estado que contém este handoff.
3. Leia este documento e todos os arquivos `docs/architecture/*.md`.
4. Verifique os PRs #1, #2 e #3, branches, commits e checks atuais.
5. Conecte separadamente Supabase e Vercel pelas contas corretas; confirme IDs e ambientes antes de executar qualquer operação.
6. Revalide Metricool/Supermetrics e cada perfil social no próprio serviço.
7. Faça inventário dos secrets necessários, mas configure-os no cofre/gerenciador de ambiente do Antigravity ou nas variáveis locais protegidas — nunca no repositório ou neste documento.
8. Produza auditoria do estado real antes de editar ou reescrever módulos.
9. Preserve branches e PRs existentes; crie nova branch para mudanças próprias.
10. Não faça merge em `main`, deploy de produção, publicação social ou migration hospedada sem autorização explícita.

