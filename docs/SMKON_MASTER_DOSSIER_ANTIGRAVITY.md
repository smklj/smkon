# SMKON / SMKONLJ — Dossiê Mestre de Continuidade, Histórico e Plano de Execução

**Versão:** 1.0  
**Data de consolidação:** 18/11/2026  
**Projeto:** SMKON  
**Identidade operacional exclusiva:** `smkonlj@gmail.com`  
**GitHub:** [smklj/smkon](https://github.com/smklj/smkon)  
**Branch de referência deste dossiê:** `feature/content-growth-studio-mvp`  
**Documento complementar:** [ANTIGRAVITY_HANDOFF.md](./ANTIGRAVITY_HANDOFF.md)

> Este documento consolida o histórico disponível das conversas e do repositório. Ele não inventa etapas ausentes. Cada item é classificado como **feito/registrado**, **parcial**, **planejado** ou **a validar**. Conectores disponíveis no ChatGPT não são automaticamente integrações do produto SMKON.

---

# 1. Regra de identidade e separação de contas

## 1.1 Regra obrigatória do Owner

O usuário estabeleceu em 17/11/2026 que o projeto SMKON deve usar **exclusivamente contas ligadas a `smkonlj@gmail.com`**.

- Identidade de trabalho: `smkonlj@gmail.com`.
- GitHub oficial: `smklj`.
- Repositório: `smklj/smkon`.
- Não misturar com conta pessoal ou com identidades usadas em outros projetos.
- SMKON deve permanecer separado de NEXO, BMI9 e demais projetos.
- Não usar conta pessoal como fallback, nem conectar recursos de outros projetos sem autorização explícita.
- O Antigravity deve autenticar cada serviço usando a identidade SMKON e confirmar o e-mail/organização antes de executar ações.

**Atenção:** o ambiente ChatGPT pode exibir mais de uma conexão de GitHub/Vercel. Para operações SMKON, selecionar a conexão/conta identificada como **GitHub / smklj** e **Smkon / smkonlj@gmail.com**. Não selecionar a conta pessoal/Primary.

## 1.2 Segurança de credenciais

Este dossiê intencionalmente não contém senhas, tokens, cookies, chaves privadas, refresh tokens ou valores de variáveis de ambiente. O Antigravity deve autenticar-se de forma própria e armazenar secrets em variáveis protegidas ou gerenciador de secrets.

Nunca:
- commitar `.env.local`, tokens ou chaves;
- expor segredo server-side em variável `NEXT_PUBLIC_*`;
- copiar credenciais de uma sessão do ChatGPT para outro agente;
- registrar secrets em logs, issues, documentação ou prompts;
- conectar contas pessoais para contornar falta de acesso à conta SMKON.

---

# 2. O que é o SMKON

SMKON foi concebido como um **Control Center para social commerce, inteligência/curadoria de produtos, criação de conteúdo, distribuição, crescimento e gestão financeira**.

O objetivo é centralizar o ciclo operacional:
1. descobrir e avaliar produtos;
2. organizar evidências, fontes, preços e riscos;
3. criar briefing, roteiro e materiais de conteúdo;
4. revisar direitos, disclosure e conformidade;
5. aprovar a versão exata do conteúdo;
6. agendar ou publicar nos canais autorizados;
7. coletar métricas e resultados;
8. reconciliar vendas, custos, comissões e pagamentos;
9. usar automações e agentes de IA com limites e auditoria.

Princípios estabelecidos:
- evidência antes de alegações;
- utilidade antes de comissão;
- conteúdo só é distribuído após aprovação humana da versão exata, confirmação de direitos e disclosure aplicável;
- gastos, campanhas, compras, assinaturas e contratações exigem autorização explícita do Owner;
- APIs oficiais, termos de uso, elegibilidade e rate limits devem ser respeitados;
- menor privilégio, RLS, auditoria, idempotência e retries limitados;
- nenhuma conexão pode ser apresentada como funcional sem teste ponta a ponta.

---

# 3. Arquitetura funcional: oito áreas

A arquitetura-alvo foi organizada em oito áreas operacionais:

## 3.1 Estratégia e gestão
- roadmap e prioridades;
- metas e KPIs;
- indicadores por canal e por domínio financeiro;
- decisões e histórico;
- governança e aprovações.

## 3.2 Inteligência de produtos
- catálogo e descoberta;
- pesquisa de produto e concorrência;
- fontes e evidências;
- preço, avaliações e disponibilidade;
- riscos, elegibilidade e scoring;
- histórico de mudanças e rastreabilidade.

## 3.3 Conteúdo e distribuição
- ideias e pautas;
- pesquisa e briefing;
- roteiros, legendas, CTA e hashtags;
- biblioteca de mídia;
- direitos autorais/licenças;
- revisão e aprovação;
- calendário e agendamento;
- publicação;
- métricas e análise pós-publicação.

## 3.4 IA e agentes
Modelo conceitual de agentes:
- **Scout:** descoberta de produtos, tendências e oportunidades.
- **Analyst:** avaliação de evidências, dados, métricas e rentabilidade.
- **Creative:** briefing, roteiro, legenda e variações criativas.
- **Publisher:** preparação de calendário e publicação dentro de permissões aprovadas.
- **Growth:** análise de desempenho e propostas de experimentos.
- **Finance:** consolidação, conciliação e relatórios.
- **Compliance:** revisão de direitos, disclosures, políticas e riscos.

Orquestração-alvo: Planner → Executor → Verifier, com ferramentas em allowlist, limites de custo/uso, logs, avaliações, aprovação humana e kill switch. Esses nomes e desenho são arquitetura proposta/documentada, não prova de agentes já implementados.

## 3.5 Financeiro
- ledger e lançamentos;
- receitas e custos;
- comissões previstas/aprovadas/pagas;
- conciliação;
- relatórios por período;
- rastreabilidade até a plataforma de origem.

## 3.6 Jurídico e conformidade
- políticas das plataformas;
- direitos autorais e licenças;
- autorização de uso de vídeos e imagens;
- disclosure de publicidade/afiliado;
- privacidade e consentimentos;
- elegibilidade e restrições de programas.

## 3.7 Audiência e relacionamento
- canais e comunidades;
- feedback;
- atendimento;
- CRM;
- parcerias;
- relacionamento com audiência.

## 3.8 Segurança e infraestrutura
- GitHub e controle de versão;
- Vercel e deploy;
- Supabase, Auth, PostgreSQL e RLS;
- OAuth e escopos;
- secrets;
- CI/CD;
- observabilidade;
- alertas e backups.

---

# 4. Modelo financeiro: três domínios separados

Os três domínios financeiros foram definidos como subdivisões do Financeiro, sem substituir as oito áreas:

## 4.1 Mídia e anúncios
Plataformas previstas:
- Meta Ads;
- Google Ads;
- Google Analytics 4 (GA4).

Regra: investimento em mídia é **custo de aquisição**, não receita.

## 4.2 Vendas próprias
Plataformas previstas:
- Mercado Livre;
- TikTok Shop Seller;
- Shopify.

Regra: separar pedido, pagamento, liquidação, estorno, taxas e receita efetivamente reconhecida.

## 4.3 Afiliados e comissões
Plataformas/programas previstos:
- Shopee Afiliados;
- Amazon Associados / Amazon Creators;
- TikTok Shop Affiliate.

Regra: comissão prevista, aprovada, cancelada e paga são estados diferentes. Não misturar comissão com venda própria.

## 4.4 Regras de consolidação
- não misturar os três domínios;
- manter origem, moeda, identificador externo e timestamps;
- deduplicar eventos;
- registrar estornos/cancelamentos;
- distinguir valor bruto, taxas, custo, comissão e valor líquido;
- reconciliar os dados com a fonte original.

---

# 5. Histórico do trabalho — linha do tempo reconstruída

> A linha do tempo abaixo usa o histórico disponível. Quando não há registro de um clique, autorização específica ou execução, isso é declarado como não comprovado.

## Etapa 1 — definição da identidade SMKON (17/11/2026)
**Registrado:**
- foi definida a identidade operacional `smkonlj@gmail.com`;
- foi identificada a conta GitHub `smklj`;
- o repositório privado `smklj/smkon` foi identificado inicialmente vazio;
- foi estabelecida a separação entre SMKON e outros projetos;
- foi dada a restrição de usar exclusivamente contas vinculadas ao e-mail SMKON.

**Critério para continuidade:** confirmar a identidade da conta em cada conector antes de ler ou alterar recursos.

## Etapa 2 — concepção do Control Center
**Definido/documentado:**
- painel central para produto, conteúdo, afiliados, vendas, comissões, crescimento, financeiro e automações;
- oito áreas funcionais;
- três domínios financeiros;
- APIs oficiais e OAuth como caminho preferencial;
- aprovação humana para ações sensíveis.

**Agentes conceituais propostos:** Scout, Analyst, Creative, Publisher, Growth, Finance e Compliance.

**Não comprovado:** que todos os agentes estejam implementados, executando ou conectados a ferramentas reais.

## Etapa 3 — conexão e identificação de ferramentas
**Conectores efetivamente usados/identificados no contexto de trabalho:**
- GitHub para repositório, arquivos, branches, commits e PRs;
- Supabase para localizar/consultar o projeto;
- Vercel para localizar equipe/projeto e consultar recursos;
- Metricool e Supermetrics aparecem em snapshots/contexto de conexões sociais e analytics;
- Notion aparece como conectado/disponível para consulta documental.

**Limite:** autorização no ChatGPT não transfere login ou token ao Antigravity e não significa integração de runtime no SMKON.

## Etapa 4 — fundação do repositório e arquitetura
**Registrado no histórico do código:**
- Next.js App Router;
- TypeScript e React;
- Supabase SSR;
- clientes Supabase browser/server;
- fluxo de login, signup e callback PKCE;
- proxy de refresh de sessão;
- estrutura inicial de organização/membros/roles;
- migrations SQL versionadas;
- políticas RLS e verificações de isolamento por tenant;
- CI com auditoria de dependências, typecheck, lint e build.

**A validar:** estado real dos checks, testes e migrations no ambiente remoto.

## Etapa 5 — separação de domínios de receita
**Registrado:**
- PR #1 para separar mídia/anúncios, vendas próprias e afiliados/comissões;
- branch `feature/revenue-stream-split`.

**A validar:** status atual do PR e se foi integrado à branch principal.

## Etapa 6 — fundação de segurança, tenant e Auth
**Registrado:**
- PR #2 para fundação de segurança, tenant e Supabase SSR;
- branch `fix/sprint-1-security-auth-foundation`.

**A validar:** status atual do PR, políticas efetivamente aplicadas e testes multi-tenant.

## Etapa 7 — Content Studio MVP
**Registrado no PR #3:**
- rota `/studio`;
- briefing com título, produto, link do produto e vídeo de referência;
- confirmação de autorização/licença para vídeos de terceiros;
- seleção de YouTube, Instagram e TikTok;
- campos de roteiro, legenda, CTA e hashtags;
- rascunhos, edição, exclusão e filtros por status;
- prévia de legenda por canal;
- cópia de texto;
- persistência atual via `localStorage`.

**Backend preparado:**
- rota autenticada `/api/content`;
- GET, POST, PATCH e DELETE;
- busca/criação de workspace organizacional;
- operações limitadas ao workspace do usuário;
- migration `content_items` com RLS.

**Limitação crítica:** a interface ainda não foi conectada à API CRUD; os rascunhos continuam em `localStorage`. A migration está no Git, mas não se deve afirmar que foi aplicada ao Supabase hospedado.

## Etapa 8 — CI e governança
**Registrado:**
- workflow `.github/workflows/ci.yml`;
- etapas de instalação, audit, typecheck, lint e build;
- mudanças organizadas por branches e PRs.

**A validar:** execução mais recente e status dos checks.

## Etapa 9 — documentação de handoff
**Registrado:**
- foi criado `docs/ANTIGRAVITY_HANDOFF.md`;
- arquivo está na branch `feature/content-growth-studio-mvp`;
- commit de referência registrado no histórico: `7215b08571eecfcd7c7ebb0a62ff0e4f65b7e0ac`;
- blob SHA anteriormente consultado: `efe90cc98d170a44a42223f0447a3575655ca220`.

Este dossiê mestre complementa o handoff anterior, com maior detalhamento do histórico, conectores, status e plano por fases.

---

# 6. Estado do GitHub e arquivos conhecidos

## 6.1 Repositório
- Owner: `smklj`
- Repositório: `smklj/smkon`
- URL: https://github.com/smklj/smkon
- Identidade: `smkonlj@gmail.com`
- Branch de referência: `feature/content-growth-studio-mvp`

## 6.2 Branches registradas
- `main`
- `feature/revenue-stream-split`
- `fix/sprint-1-security-auth-foundation`
- `feature/content-growth-studio-mvp`

## 6.3 Pull requests registrados
- PR #1 — separação dos domínios de receita: https://github.com/smklj/smkon/pull/1
- PR #2 — fundação de segurança, tenant e Supabase SSR: https://github.com/smklj/smkon/pull/2
- PR #3 — Content Studio MVP: https://github.com/smklj/smkon/pull/3

O PR #3 foi registrado como draft/aberto na última consulta e tinha como base `fix/sprint-1-security-auth-foundation`, não necessariamente `main`. Verificar o estado atual antes de qualquer ação.

## 6.4 Arquivos conhecidos
- `src/app/studio/page.tsx`
- `src/app/studio/studio-client.tsx`
- `src/app/api/content/route.ts`
- `supabase/migrations/20261117200000_content_studio.sql`
- `.github/workflows/ci.yml`
- `.env.example`
- `docs/ANTIGRAVITY_HANDOFF.md`

Arquivos e paths devem ser confirmados na branch atual antes de editar.

## 6.5 Stack e comandos
- Next.js 16.4.6
- React 19.2.1 / React DOM 19.2.1
- TypeScript 5.9.3
- Supabase JS 2.119.0
- Supabase SSR 0.12.7
- ESLint 9.39.1
- Node.js 22 no CI

Comandos:
```bash
npm install
cp .env.example .env.local
npm run dev
npm run typecheck
npm run lint
npm run build
```

Usar apenas variáveis de ambiente de desenvolvimento/Preview autorizadas.

---

# 7. Inventário de conectores, plugins e plataformas

## Como interpretar esta lista

Há quatro categorias diferentes:
1. **Conector usado diretamente no trabalho SMKON:** há evidência de uso no projeto.
2. **Conta/conexão identificada em snapshot:** houve referência a uma conta ou fonte, mas precisa revalidar estado atual.
3. **Ferramenta disponível no ambiente ChatGPT:** aparece no ambiente, mas isso não prova conexão à conta SMKON.
4. **Integração de negócio planejada:** plataforma desejada, sem comprovação de OAuth/integração concluída no código.

Não apresentar todas essas categorias como “integrações prontas”.

## 7.1 GitHub — conector usado diretamente
**Conta SMKON:** `smklj`  
**E-mail:** `smkonlj@gmail.com`  
**Repositório:** `smklj/smkon`

Uso no trabalho:
- consultar perfil e repositório;
- ler arquivos;
- inspecionar branches e commits;
- criar/atualizar arquivos;
- organizar alterações em branches;
- acompanhar PRs e workflows.

Procedimento para Antigravity:
1. autenticar GitHub com a conta `smklj`;
2. confirmar e-mail/owner;
3. abrir `smklj/smkon`;
4. clonar a branch de referência;
5. verificar PRs, commits, arquivos e CI;
6. criar branch nova para cada bloco de trabalho;
7. abrir PR para revisão.

**Não usar a conta pessoal/Primary.**

## 7.2 Supabase — conector usado para localizar o projeto
**Organização identificada:** Smkon  
**Projeto:** `smkonlj`  
**Project ref:** `hpplboyysmfcjsnjrdmw`  
**Região reportada:** `us-west-2`  
**Banco:** PostgreSQL 17  
**Status reportado pelo conector:** `ACTIVE_HEALTHY`

Uso/arquitetura:
- PostgreSQL;
- Auth;
- RLS;
- migrations;
- clientes browser/server via Supabase JS e SSR;
- base multi-tenant.

Variáveis esperadas no projeto:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_SITE_URL`
- `SUPABASE_SECRET_KEY` apenas server-side, se necessário.

Como validar:
1. autenticar no Supabase com identidade SMKON;
2. confirmar organização e project ref;
3. confirmar Auth providers e redirect URLs;
4. inspecionar histórico de migrations;
5. confirmar tabelas e policies RLS;
6. testar dois usuários em workspaces distintos;
7. não aplicar migration hospedada sem autorização expressa.

**Não comprovado:** que as migrations recentes da branch tenham sido aplicadas ao projeto hospedado.

## 7.3 Vercel — conector usado para localizar equipe/projeto
**Equipe/conta identificada:** Smkon  
**E-mail associado:** `smkonlj@gmail.com`  
**Projeto:** `smkon`  
**Project ID:** `prj_udn2T9xYctnJU8uq4oE6wjzPF5qK`

Uso registrado:
- selecionar equipe;
- localizar projeto;
- consultar recursos do projeto.

Verificações obrigatórias:
1. entrar na equipe Smkon;
2. confirmar e-mail da conta;
3. confirmar vínculo com `smklj/smkon`;
4. confirmar branch de produção;
5. verificar Preview deployments;
6. conferir variáveis de ambiente sem expor valores;
7. verificar logs e último deployment;
8. testar Preview antes de qualquer promoção.

**Não comprovado:** que o vínculo Git, a branch de produção e o deploy automático estejam todos corretos no estado atual. Não fazer deploy de produção sem autorização.

## 7.4 Metricool — conexão social registrada em snapshot
Perfis associados no contexto histórico:
- Instagram: `smkonlj`
- TikTok: `smkonlj`
- Pinterest: `smkonlj`
- YouTube: canal `UCi4ojwzDB77Geb5ytrXqJ9w`

Uso previsto:
- calendário de conteúdo;
- consulta de posts;
- gestão de posts agendados;
- publicação, se permissões e integrações estiverem válidas.

Fluxo de validação:
1. autenticar Metricool na conta de trabalho;
2. confirmar marca SMKON;
3. confirmar cada perfil e permissões;
4. consultar calendário e posts existentes;
5. verificar formatos, limites e status;
6. testar apenas em ambiente controlado e sem publicar em perfil real sem aprovação.

**Limite:** o registro histórico não comprova que cada canal continua conectado nem que publicação foi testada ponta a ponta.

## 7.5 Supermetrics — conexão de analytics registrada em snapshot
Snapshot histórico:
- TikTok Organic — autenticado/conectado no snapshot;
- Instagram Insights — autenticado/conectado no snapshot;
- Pinterest Organic — autenticado/conectado no snapshot;
- YouTube — pendente de validação final;
- Meta Ads — não autenticado naquele registro;
- Amazon Ads — não autenticado naquele registro.

Fluxo técnico documentado:
1. `data_source_discovery`;
2. `accounts_discovery`;
3. `field_discovery`;
4. executar consulta com dimensões, métricas, datas e filtros;
5. validar timezone e origem;
6. reconciliar com a plataforma original.

**Limite:** autenticação não prova que todos os relatórios foram testados nem que os dados são persistidos no banco SMKON. Supermetrics é fonte de analytics, não ferramenta de publicação.

## 7.6 Notion — ferramenta/conector identificado
Notion aparece como conectado/disponível no ambiente de trabalho. Deve ser usado para pesquisar documentação, decisões e registros existentes antes de recriar conteúdo.

**Não comprovado:** integração de Notion no runtime do SMKON ou sincronização automática com o banco.

## 7.7 Ferramentas e plugins disponíveis no ambiente ChatGPT

O ambiente de assistência lista as ferramentas abaixo. Elas podem apoiar o trabalho, mas **não são todas integrações de produto SMKON** e não se deve presumir que estejam autorizadas com a conta SMKON.

| Ferramenta / plugin | Uso possível no projeto | Situação SMKON |
|---|---|---|
| GitHub | Código, branches, PRs, issues, CI | Usado diretamente com `smklj` |
| Supabase | Banco, Auth, RLS, migrations | Projeto SMKON identificado |
| Vercel | Hosting, Preview e deploy | Projeto/equipe identificados; vínculo/deploy a validar |
| Notion | Documentação e decisões | Conector disponível/conectado no ambiente; conteúdo a pesquisar |
| Dropbox | Arquivos e materiais | Disponível; não há integração SMKON comprovada |
| Gmail | E-mail operacional | Disponível; não há automação SMKON comprovada |
| Google Calendar | Agenda e calendário | Disponível; não há integração SMKON comprovada |
| Adobe | Ferramentas criativas e edição | Disponível; não há pipeline SMKON comprovado |
| Adobe Acrobat | PDF e documentos | Disponível; não há pipeline SMKON comprovado |
| Canva | Artes, criativos e templates | Disponível; não há integração SMKON comprovada |
| Figma | UI/UX e design | Disponível; não há integração SMKON comprovada |
| Runway | Criação/edição de mídia | Disponível; não há integração SMKON comprovada |
| Metricool | Calendário e gestão social | Snapshot de perfis SMKON registrado; revalidar |
| Supermetrics | Analytics e dados de canais | Snapshot de fontes registrado; revalidar |
| Shopify | Loja e comércio | Ferramenta disponível; loja SMKON não comprovada |
| OpenSEO | SEO e pesquisa | Disponível; não há integração SMKON comprovada |
| Similarweb | Inteligência competitiva | Disponível; não há integração SMKON comprovada |
| vidIQ | Pesquisa e analytics YouTube | Disponível; não há integração SMKON comprovada |
| Resend | E-mail transacional | Disponível; domínio/integração SMKON não comprovados |
| Indeed Job Search | Busca de vagas | Disponível; sem relação operacional confirmada com SMKON |

### Nota sobre “plugins que foram feitos”
No histórico disponível, não há evidência de que tenham sido desenvolvidos plugins próprios do SMKON como extensões instaláveis ou pacotes independentes. O que foi registrado são conectores de serviços externos, ferramentas disponíveis no ambiente ChatGPT e integrações planejadas. Se algum plugin customizado foi criado fora do material acessível, ele precisa ser identificado no repositório ou na conta correspondente antes de ser declarado como existente.

## 7.8 Plataformas externas de negócio planejadas — ainda não tratadas como conectadas

| Plataforma | Objetivo | Estado |
|---|---|---|
| Meta Business / Meta Ads | Campanhas e métricas de mídia | Não considerar autenticado sem nova validação |
| Google Ads | Dados e custos de anúncios | Planejado |
| GA4 | Analytics do site/conversões | Planejado |
| Shopee Afiliados | Links e comissões | Pendente de conexão/elegibilidade |
| TikTok Shop Seller | Vendas próprias | Pendente; fluxo separado de afiliados |
| TikTok Shop Affiliate | Comissões de afiliado | Pendente; fluxo separado de Seller |
| Mercado Livre | Vendas próprias | Requer API/OAuth oficial |
| Amazon Associados / Creators | Afiliados e comissões | Validar programa e elegibilidade |
| Amazon Seller Central | Vendas próprias | Fluxo separado de Amazon Associates |
| Shopify | Loja própria | Conector disponível; loja SMKON não comprovada |

---

# 8. Estado real por funcionalidade

| Área | Estado registrado | Próxima validação |
|---|---|---|
| Repositório GitHub | Existe e foi trabalhado | Revisar branches, PRs e CI atuais |
| Identidade SMKON | Definida | Confirmar em cada serviço |
| Control Center | Fundação/interface inicial | Inspecionar cobertura funcional |
| Oito áreas operacionais | Arquitetura documentada | Mapear módulos reais no código |
| Três domínios financeiros | Separação iniciada/documentada | Revisar schema, ledger e conciliação |
| Auth Supabase | Fundação no código | Teste E2E |
| Multi-tenant/RLS | Migrations e políticas versionadas | Teste real entre tenants |
| Content Studio UI | MVP implementado | Revisar UX e validação |
| Content Studio API | CRUD autenticado criado | Testar endpoints e autorização |
| Persistência do Studio | Ainda em localStorage na UI | Integrar UI à API |
| Migration de conteúdo | Versionada no Git | Verificar/aplicar só com autorização |
| Biblioteca de mídia | Não pronta | Definir Storage e permissões |
| Editor de vídeo timeline | Não pronto | Projetar/implementar em fase própria |
| OAuth redes sociais | Não concluído | Mapear escopos e aprovação |
| Agendamento/publicação | Não validado | Implementar fila e idempotência |
| Analytics | Snapshots de conectores | Revalidar contas e dados |
| Financeiro real | Não integrado ponta a ponta | APIs e conciliação |
| Agentes IA | Arquitetura proposta | Implementar allowlist, limites e auditoria |
| Observabilidade/backup | Pendente | Definir alertas, logs e restore |
| Deploy produção | Não presumir concluído | Verificar Vercel; aprovação antes de promover |

---

# 9. Plano do que faremos — fases e critérios de aceite

## Fase 0 — preservar e auditar (primeira atividade do Antigravity)
1. autenticar exclusivamente com a identidade SMKON;
2. clonar o repositório e preservar branches existentes;
3. ler este dossiê e `docs/ANTIGRAVITY_HANDOFF.md`;
4. ler todos os documentos de `docs/architecture/`;
5. revisar PRs #1, #2 e #3, commits, diffs e checks;
6. rodar instalação, typecheck, lint e build;
7. produzir matriz de status: pronto, parcial, planejado, quebrado e não validado;
8. listar riscos e dependências;
9. não alterar produção.

**Aceite:** relatório de auditoria reproduzível, com evidência de arquivos, testes e estado de PR.

## Fase 1 — estabilizar fundação
1. revisar Auth, PKCE, sessão e refresh;
2. revisar workspace/tenant e papéis;
3. revisar RLS e bootstrap de workspace;
4. testar isolamento com pelo menos dois usuários e dois workspaces;
5. corrigir validações, status HTTP e erros;
6. revisar dependências e advisories;
7. garantir CI executando em PRs e branches relevantes.

**Aceite:** testes de autenticação e isolamento multi-tenant passando; CI verde.

## Fase 2 — conectar Content Studio à persistência real
1. revisar schema `content_items`;
2. revisar API GET/POST/PATCH/DELETE;
3. definir migração de drafts locais sem perda;
4. integrar a UI com a API autenticada;
5. adicionar loading, empty state, erros, retry seguro e estado offline;
6. garantir que cada operação respeite workspace/tenant;
7. testar criação, edição, filtro, exclusão e recuperação de drafts;
8. confirmar que a UI não apresenta localStorage como persistência cloud.

**Aceite:** conteúdo criado em um dispositivo/sessão é recuperado de forma autenticada e isolada no workspace correto; testes CRUD e RLS passam.

**Restrição:** migrations hospedadas somente após autorização explícita do Owner.

## Fase 3 — biblioteca de mídia e direitos
1. definir buckets e políticas de Storage;
2. upload seguro e validação de MIME/tamanho;
3. metadados e associação ao conteúdo;
4. registro de origem e licença;
5. confirmação de direitos para materiais de terceiros;
6. fluxo de revisão e aprovação.

**Aceite:** arquivos armazenados com acesso privado/autorizado e trilha de direitos.

## Fase 4 — experiência de produção de conteúdo
1. detalhar editor de conteúdo;
2. definir se o editor de vídeo será interno ou integração externa;
3. especificar timeline, cortes, trilhas, legendas, templates, renderização e exportação;
4. definir limites de formatos e duração;
5. manter separação entre edição, aprovação e publicação.

**Aceite:** escopo técnico e protótipo validado antes de iniciar desenvolvimento pesado.

## Fase 5 — conexões sociais e publicação
1. inventariar perfis e permissões em Metricool;
2. revalidar Supermetrics para analytics;
3. definir integrações oficiais por canal;
4. mapear OAuth, scopes, tokens e expiração;
5. criar fila de publicação, retries limitados e idempotência;
6. validar versão exata aprovada;
7. registrar status, IDs externos e erros;
8. implementar cancelamento e reconciliação.

**Aceite:** fluxo testado em ambiente permitido; publicação real somente após aprovação explícita.

## Fase 6 — inteligência e catálogo de produtos
1. definir fontes oficiais e permitidas;
2. padronizar produto, variante, preço, disponibilidade e origem;
3. criar evidências e histórico;
4. scoring explicável;
5. identificar risco de alegações, direitos e elegibilidade;
6. separar oportunidade de afiliado de venda própria.

**Aceite:** toda recomendação tem fonte, timestamp e justificativa auditável.

## Fase 7 — integrações financeiras
1. priorizar plataformas conforme elegibilidade e acesso;
2. criar conectores por plataforma com OAuth oficial;
3. normalizar pedidos, pagamentos, taxas, estornos e comissões;
4. separar mídia, vendas próprias e afiliados;
5. criar ledger e conciliação;
6. tratar duplicidade, moeda, timezone e status;
7. gerar relatórios por período e por origem.

**Aceite:** totais conciliáveis com plataformas originais e trilha de auditoria.

## Fase 8 — agentes e automações
1. implementar Planner/Executor/Verifier;
2. criar allowlist de ferramentas;
3. impor permissões por papel e workspace;
4. limitar custo, frequência e volume;
5. criar logs e avaliações;
6. incluir aprovação humana para ações sensíveis;
7. implementar kill switch;
8. começar com leitura/análise antes de permitir escrita/publicação.

**Aceite:** agentes não executam ações fora de escopo e toda ação sensível é rastreável.

## Fase 9 — operação, observabilidade e produção
1. logs estruturados e correlação;
2. alertas e monitoramento;
3. backups e teste de restauração;
4. segurança e testes de regressão;
5. revisão de variáveis de ambiente;
6. Preview por PR;
7. checklist de release;
8. aprovação explícita antes de deploy de produção.

**Aceite:** checklist de release completo, rollback conhecido e autorização do Owner.

---

# 10. Auditoria técnica obrigatória para Antigravity

Verificar pelo menos:
- compatibilidade e ordem das migrations;
- bootstrap do workspace e risco de escalada de privilégio;
- concorrência na criação de workspace;
- policies RLS para SELECT/INSERT/UPDATE/DELETE;
- autorização por tenant em todas as rotas;
- validação de URLs e payloads;
- status HTTP para erros e registros inexistentes;
- PATCH parcial versus payload completo;
- migração segura de localStorage;
- tratamento de loading, offline, retry e duplicidade;
- secrets no Git, build, logs e documentação;
- CI e checks de cada PR;
- advisories e breaking changes;
- README e docs desatualizados;
- rotas protegidas quando Supabase estiver configurado;
- logs, observabilidade, backup e restauração;
- consistência entre documentação, migrations e código real.

Não usar `npm audit fix --force` sem analisar breaking changes. Não simular OAuth, publicação, sincronização ou dados reais.

---

# 11. Governança: ações que exigem aprovação explícita

Sem autorização explícita, o Antigravity não pode:
- fazer merge em `main`;
- promover deploy para produção;
- aplicar migrations no Supabase hospedado;
- alterar DNS ou variáveis de produção;
- criar serviços pagos, assinaturas ou gastos;
- comprar mídia, produtos ou contratar serviços;
- publicar conteúdo em perfis reais;
- enviar comunicações em nome da marca;
- conectar contas que não pertençam à identidade SMKON;
- compartilhar dados entre SMKON e outros projetos.

Pode, dentro das permissões concedidas:
- auditar;
- rodar testes locais;
- criar branches de feature;
- preparar commits e PRs;
- criar documentação;
- implementar em ambiente local/Preview autorizado.

---

# 12. Prompt mestre para o Antigravity

Você está assumindo a continuidade do projeto SMKON. A identidade operacional autorizada é exclusivamente `smkonlj@gmail.com`, com GitHub `smklj` e repositório `smklj/smkon`. Não use contas pessoais nem misture SMKON com NEXO, BMI9 ou outros projetos.

Antes de programar:
1. leia integralmente este documento e `docs/ANTIGRAVITY_HANDOFF.md`;
2. leia todos os documentos em `docs/architecture/`;
3. inspecione todo o código, migrations, testes, workflows, branches e PRs;
4. confirme a conta ativa de GitHub, Supabase e Vercel;
5. diferencie implementado, parcial, planejado e não validado;
6. execute os comandos de validação local;
7. produza auditoria, matriz de funcionalidades, riscos e plano faseado.

Preserve Next.js App Router, TypeScript, Supabase SSR, PostgreSQL e RLS salvo justificativa documentada. Preserve as oito áreas e os três domínios financeiros separados. Priorize fundação, testes e persistência do Content Studio antes de integrações externas.

Não invente dados, credenciais, contas, permissões ou status. Não declare conector operacional sem teste ponta a ponta. Não faça merge em main, deploy de produção, migration hospedada, publicação social ou gasto sem autorização explícita do Owner. Toda publicação exige aprovação da versão exata, direitos e disclosure.

**Primeira entrega obrigatória:** relatório de auditoria com evidências, matriz de status, bugs priorizados, plano de persistência cloud do Content Studio, plano de testes unitários/integração/RLS/E2E e estimativa por fase. Só depois iniciar alterações de grande porte.

---

# 13. Referências e links

- Repositório: https://github.com/smklj/smkon
- Branch de referência: https://github.com/smklj/smkon/tree/feature/content-growth-studio-mvp
- PR #1: https://github.com/smklj/smkon/pull/1
- PR #2: https://github.com/smklj/smkon/pull/2
- PR #3: https://github.com/smklj/smkon/pull/3
- Handoff técnico anterior: https://github.com/smklj/smkon/blob/feature/content-growth-studio-mvp/docs/ANTIGRAVITY_HANDOFF.md
- Arquivo ZIP da branch: https://github.com/smklj/smkon/archive/refs/heads/feature/content-growth-studio-mvp.zip

---

# 14. Limites desta consolidação

Este documento reúne o histórico de conversa e os registros técnicos disponíveis no momento da criação. Não é possível afirmar que cada serviço foi conectado por um fluxo específico de cliques, pois o histórico não preserva todas as telas/etapas de OAuth. Por isso, procedimentos de reconexão foram descritos como instruções operacionais, não como relato literal de cada clique passado.

A lista de plugins inclui ferramentas disponíveis no ambiente ChatGPT, e não apenas conexões SMKON. A presença de um plugin não prova que o usuário o configurou para SMKON, que a conta SMKON foi autorizada ou que o código do produto o utiliza.

Antes de qualquer execução, o Antigravity deve revalidar o estado atual diretamente nos serviços e no repositório.

**Fim do dossiê mestre SMKON.**


---

# 15. Atualização operacional — auditoria e preparação de produção (18/11/2026)

## 15.1 Estado confirmado nesta sessão
- Branches existentes revalidadas: `main`, `feature/admin-panel`, `feature/product-intelligence-mvp`, `feature/content-growth-studio-mvp`, `feature/revenue-stream-split`, `fix/sprint-1-security-auth-foundation`, `feature/admin-dashboard-mvp` e `feat/fila-status-machine`.
- `feature/admin-panel` está 58 commits à frente de `main`, sem commits atrás na comparação consultada.
- `feature/product-intelligence-mvp` diverge de `feature/admin-panel`: 2 commits próprios e 58 commits atrás. Não fazer merge automático.
- Criada branch de integração controlada `feature/smkon-production-readiness` a partir de `feature/admin-panel`.
- Nessa branch foram adicionados tipos, scoring, geração de preview de conteúdo e endpoint autenticado de Product Intelligence. O endpoint continua sem persistência; GET retorna lista vazia e POST retorna preview HTTP 202.
- Migration de Product Intelligence foi versionada como draft e permanece não aplicada.
- Criado `docs/PRODUCTION_READINESS.md` com evidências e bloqueadores.
- Mantidos `main` e os PRs existentes sem merge.

## 15.2 Supabase — estado real consultado
- Projeto `hpplboyysmfcjsnjrdmw`, região `us-west-2`, status `ACTIVE_HEALTHY`.
- Histórico remoto de migrations retornou vazio.
- Advisors de segurança e performance retornaram zero lints na consulta; isso não valida migrations não aplicadas nem substitui testes de RLS.
- A migration base `20261117183000_split_01_revenue_domains.sql` cria organizações, membros e domínios financeiros. Content Studio e Product Intelligence dependem dessa base.
- Não foi aplicada migration hospedada nesta sessão.
- Antes de habilitar Auth/CRUD, validar bootstrap do Owner, Auth redirect URLs, cadeia de migrations e isolamento multi-tenant.

## 15.3 Vercel — estado real consultado
- Projeto `smkon`, equipe Smkon, project ID `prj_udn2T9xYctnJU8uq4oE6wjzPF5qK`.
- Domínio listado: `smkon-smkon.vercel.app`.
- Variáveis listadas para o projeto: zero; `hiddenProductionEnvCount = 0`. Nenhum valor secreto foi solicitado ou exposto.
- Node.js configurado no projeto foi reportado como `26.x`; a matriz atual do conector aceita 20.x, 22.x e 24.x. Revisar/ajustar para versão LTS suportada antes do release.
- Último deployment Production consultado: estado `CANCELED`.
- Preview `dpl_dgdv2DR88L3xYHpFe6Z8edEToXqE` estava `READY` para commit `71297cd53181d366045426e4fc0aaa2416d4da3f`, branch `feature/admin-panel`.
- Esse Preview não foi promovido para Production.
- Sem variáveis de ambiente e sem schema/Auth no host, login, Content Studio e APIs protegidas não podem ser considerados funcionais em produção.

## 15.4 Decisão de release
A autorização do Owner para publicação direta foi registrada nesta conversa, mas a promoção não deve ocorrer enquanto houver bloqueadores objetivos de runtime: variáveis Supabase ausentes, migrations remotas ausentes e Auth/bootstrap/RLS sem validação. Publicar nesse estado criaria uma versão com funcionalidades centrais quebradas ou indisponíveis.

## 15.5 Próximas ações necessárias
1. Definir variáveis Supabase de Production no Vercel sem compartilhar valores no chat.
2. Configurar Supabase Auth e redirect URLs para o domínio oficial.
3. Validar as migrations em banco local descartável, incluindo dependências e políticas.
4. Confirmar usuário Owner e bootstrap de organização.
5. Testar Auth e RLS com dois tenants.
6. Integrar persistência real de Product Intelligence e validar CRUD do Content Studio.
7. Rodar CI, build e smoke tests no commit exato.
8. Criar deploy Production e verificar logs/rotas; só então confirmar release público.


---

# 16. Atualização executiva — estado consolidado, trabalho realizado e proposta atual (18/11/2026)

**Versão do dossiê:** 1.1  
**Branch deste registro:** `feature/smkon-production-readiness`  
**Repositório oficial:** `smklj/smkon`  
**Conta operacional:** `smkonlj@gmail.com`

> Esta seção atualiza e corrige os pontos operacionais da seção 15. Em caso de divergência de status entre as seções 15 e 16, prevalece a evidência mais recente desta seção. Nenhuma chave ou valor secreto é registrado aqui.

## 16.1 Resumo executivo da proposta atualizada

O SMKON deve evoluir para uma plataforma operacional de **Social Commerce Intelligence & Growth**, reunindo em um único Control Center o ciclo completo de oportunidade → produto → conteúdo → aprovação → distribuição → métricas → receita → otimização.

A plataforma não deve ser apenas um painel de links ou um gerador de posts. Seu diferencial é conectar decisões e resultados com rastreabilidade: por que um produto foi escolhido, quais evidências sustentam a recomendação, qual conteúdo foi produzido, quem aprovou a versão publicada, em qual canal foi distribuída, quais resultados trouxe e como esses resultados se refletem no financeiro.

### Proposta de valor
- **Centralização:** um ambiente para estratégia, produtos, conteúdo, canais, crescimento e financeiro.
- **Inteligência explicável:** recomendações com fontes, evidências, timestamps, critérios e score interpretável.
- **Operação controlada:** workflows com estados, aprovações, histórico e auditoria.
- **Automação segura:** agentes de IA que primeiro analisam e propõem; executam ações externas somente com permissão e aprovação adequadas.
- **Visão financeira confiável:** separar mídia, vendas próprias e afiliados/comissões, reconciliando dados com as plataformas de origem.
- **Escalabilidade:** arquitetura multi-tenant, APIs oficiais, filas idempotentes, RLS e observabilidade.

### Usuários e papéis propostos
- **Owner/Admin:** estratégia, conexões, permissões, aprovação de gastos e publicação, configurações e auditoria.
- **Operator/Editor:** pesquisa, catálogo, criação e edição de conteúdo, preparação de campanhas.
- **Analyst:** leitura de métricas, scoring, relatórios e conciliação, sem permissão implícita para publicar ou gastar.
- **Viewer:** leitura de painéis e relatórios.

Os papéis acima são proposta de produto; confirmar o modelo de autorização já implementado antes de codificar ou documentar como concluído.

## 16.2 Mapa atualizado do produto

| Módulo | Resultado esperado | Estado observado nesta etapa |
|---|---|---|
| Control Center / Admin | Visão operacional, áreas e indicadores | Painel presente em branch de feature; Preview READY anteriormente confirmado para commit específico |
| Product Intelligence | Catálogo, evidências, scoring e conteúdo preliminar | Tipos, scoring e preview de conteúdo adicionados; endpoint ainda não persiste dados |
| Content Studio | Briefing, roteiro, legenda, CTA, hashtags e drafts | MVP registrado; UI ainda precisa ser ligada à API cloud, localStorage não equivale a persistência compartilhada |
| Revenue Domains | Separação entre mídia, vendas próprias e afiliados | Migration/base versionada no Git; aplicação remota não confirmada |
| Analytics & Growth | Métricas por canal, experimentos e desempenho | Conectores/snapshots históricos; conexão e sincronização ponta a ponta precisam ser revalidadas |
| Social Publishing | Calendário, aprovação, agendamento e publicação | Não considerar pronto; faltam validação de APIs, OAuth, fila, idempotência e testes |
| Finance Center | Ledger, taxas, comissões, pagamentos e conciliação | Domínios definidos; integrações financeiras reais e reconciliação pendentes |
| AI Agents | Scout, Analyst, Creative, Publisher, Growth, Finance, Compliance | Papéis conceituais; implementação operacional com guardrails ainda pendente |
| Media Library | Arquivos, metadados, direitos e permissões | Planejado; Storage e políticas precisam ser definidos e testados |
| Governance & Audit | Aprovações, logs, custos, permissões e trilha de ações | Requisito transversal; completar e validar antes de automações de escrita |

## 16.3 Trabalho realizado e evidências atualizadas

### GitHub e código
- Repositório oficial mantido em `smklj/smkon`, sem misturar a conta pessoal.
- Branch `feature/smkon-production-readiness` criada a partir de `feature/admin-panel` para consolidar preparação e evitar merge cego de branches divergentes.
- Implementados nessa branch: tipos de Product Intelligence, scoring heurístico explicável, gerador de preview de conteúdo, endpoint autenticado de preview, migration draft de produtos e documentação técnica.
- O endpoint de Product Intelligence é explicitamente preview-only: ainda não grava produtos no banco.
- Dossiê mestre atualizado nesta branch.
- PR #4 aberto para revisão: https://github.com/smklj/smkon/pull/4. Na criação, o PR estava aberto e `mergeable=false`; não foi feito merge. Revisar conflitos, histórico e diffs antes de qualquer integração.
- Branches divergentes não foram fundidas automaticamente. A branch `feature/product-intelligence-mvp` contém apenas commits próprios em relação à branch do painel e está significativamente atrás dela na comparação consultada.

### Supabase — correção de estado
- Projeto oficial identificado e acessível pelo conector Supabase SMKON: ref `hpplboyysmfcjsnjrdmw`, projeto `smkonlj`.
- A conexão Supabase ↔ ChatGPT está ativa e foi usada para consultar a URL do projeto e a chave publishable ativa. Não é necessário reconectar o Supabase ao ChatGPT.
- A URL e a chave publishable foram usadas diretamente na configuração do Vercel; os valores não são reproduzidos neste documento.
- A última consulta ao histórico remoto de migrations retornou `migrations: []`. Portanto, ainda não há evidência de que a fundação SQL versionada no Git tenha sido aplicada ao banco hospedado.
- Nenhuma migration remota foi aplicada durante esta atualização.

### Vercel — correção de estado
- Projeto oficial: `smkon`, equipe Smkon, project ID `prj_udn2T9xYctnJU8uq4oE6wjzPF5qK`.
- Foi confirmado que o projeto estava sem variáveis de ambiente antes da configuração.
- Foram cadastradas com sucesso duas variáveis no Vercel, para Production, Preview e Development:
  - `NEXT_PUBLIC_SUPABASE_URL` — tipo plain, URL pública do projeto;
  - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — tipo encrypted, chave publishable pública.
- A consulta posterior confirmou as duas chaves e os três targets. Valores foram omitidos.
- O código de `src/lib/supabase/env.ts`, `src/lib/supabase/server.ts` e `src/lib/supabase/client.ts` confirma que browser e server usam essas duas variáveis.
- Não foi cadastrada `SUPABASE_SECRET_KEY`: os clientes verificados usam a publishable key e não há evidência de necessidade para o fluxo atual. Não adicionar chave privilegiada sem requisito técnico demonstrado.
- As variáveis configuradas removem o bloqueio de configuração básica do cliente Supabase, mas não provam Auth, RLS, migrations ou persistência funcionando.
- Node do projeto foi alterado para `22.x` na etapa anterior; validar build e compatibilidade no deployment atual.
- A publicação Production não foi executada.

## 16.4 Bloqueadores atuais — ordem recomendada

1. **Migrations:** reconciliar as migrations versionadas no Git com o banco remoto. Primeiro auditar todas, dependências, ordem, policies e reversibilidade; validar em banco descartável; só então solicitar/aplicar a mudança hospedada com autorização explícita.
2. **Auth e bootstrap:** confirmar providers, redirect URLs do domínio final, callback PKCE, criação do primeiro Owner e bootstrap de organização/workspace.
3. **RLS multi-tenant:** testar com pelo menos dois usuários em dois workspaces; comprovar isolamento em SELECT/INSERT/UPDATE/DELETE e nas rotas API.
4. **Build e CI:** executar install, audit, typecheck, lint, testes e build no commit exato do PR; corrigir erros e dependências vulneráveis sem aplicar upgrades breaking às cegas.
5. **Content Studio:** conectar a interface à API autenticada; migrar drafts locais sem perda; testar CRUD, loading, empty/error states e concorrência.
6. **Product Intelligence:** implementar persistência real, validação server-side, autorização por tenant, CRUD e testes; retirar a classificação preview-only somente depois disso.
7. **Integrações externas:** validar contas, scopes e APIs oficiais; implementar filas, retries limitados, idempotência, reconciliação e observabilidade.
8. **Release:** validar Preview por rotas e smoke tests, configurar Auth URLs, revisar domínio e rollback; promover para Production somente após critérios de aceite e autorização do Owner.

## 16.5 Roadmap priorizado e entregáveis

### Sprint A — estabilização e segurança
- Resolver PR #4 e divergência entre branches sem descartar trabalho.
- Revalidar histórico completo de PRs e checks.
- Fechar migration chain, bootstrap de workspace e RLS.
- Testes unitários, integração, autorização e E2E de Auth.
- Entregável: base reproduzível, CI verde e relatório de segurança.

### Sprint B — persistência dos módulos centrais
- Aplicar schema aprovado em ambiente de teste.
- Ligar Content Studio à API e banco.
- Implementar Product Intelligence persistente.
- Garantir isolamento e histórico de alterações.
- Entregável: produto e conteúdo persistidos, recuperáveis e testados.

### Sprint C — conteúdo e mídia
- Biblioteca privada de mídia e metadados.
- Direitos/licenças e disclosure como etapas do workflow.
- Aprovação de versão imutável do conteúdo.
- Entregável: ciclo de criação e revisão rastreável.

### Sprint D — canais, analytics e crescimento
- Revalidar Metricool e Supermetrics.
- Implementar conexões oficiais e calendário.
- Publicação controlada, com aprovação humana e idempotência.
- Métricas e experimentos por canal.
- Entregável: distribuição e análise com evidência de execução.

### Sprint E — financeiro e agentes
- Ledger e conciliação de mídia, vendas próprias e afiliados.
- Agentes em modo leitura/proposta inicialmente.
- Permissões, limites, auditoria, aprovação e kill switch.
- Entregável: relatórios reconciliados e automações seguras.

### Sprint F — release e operação
- Observabilidade, alertas, backups e restore testado.
- Checklist de release, rollback e smoke tests.
- Deploy Production e monitoramento pós-release.
- Entregável: versão operacional, sem declarar recursos não implementados como prontos.

## 16.6 Critérios de pronto para produção

O SMKON só pode ser declarado pronto para produção quando todos os itens abaixo tiverem evidência:
- [ ] branch e PR integrados com histórico revisado e sem conflito pendente;
- [ ] CI verde no commit exato;
- [ ] build de Production concluído;
- [ ] migrations aplicadas e reconciliadas com o Git;
- [ ] Auth, callback e redirects testados no domínio real;
- [ ] Owner e workspace inicializados corretamente;
- [ ] RLS comprovada com múltiplos tenants;
- [ ] APIs protegidas e testes CRUD aprovados;
- [ ] Content Studio com persistência cloud;
- [ ] Product Intelligence com persistência cloud ou explicitamente desabilitado na interface pública;
- [ ] variáveis de ambiente verificadas sem exposição de valores;
- [ ] smoke tests, logs, alertas e rollback validados;
- [ ] aprovação explícita do Owner para promoção Production.

## 16.7 Regras para qualquer agente que assumir o projeto

- Trabalhar exclusivamente com a identidade SMKON.
- Ler este dossiê e o handoff antes de modificar o código.
- Consultar o estado atual antes de confiar em qualquer status antigo.
- Nunca apresentar proposta, mock, preview ou endpoint sem persistência como funcionalidade concluída.
- Nunca aplicar migration remota, merge em main, alterar DNS, criar gasto, publicar conteúdo ou promover Production sem autorização e checklist.
- Registrar cada alteração com branch, commit, arquivos, testes executados, limitações e próximo passo.
- Manter a separação entre proposta de produto, implementação no código e operação comprovada.

**Fim da atualização executiva 1.1.**
