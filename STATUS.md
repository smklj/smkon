# SMKON — Status do projeto

**Última atualização:** 2026-11-18 06:24 -03 (Sprint 0 — fila + aprovação Owner)

## Pronto (esta entrega)

- Fundação Next.js App Router + TypeScript + ESLint + CI básico (`.github/workflows/ci.yml`)
- Página inicial com os 5 pilares mapeados
- **Máquina de status da fila** (client-side + localStorage):  
  `draft` → `pending_review` → `approved` → `scheduled`
- **UI de aprovação do Owner** com hash simples (djb2) da versão exata do conteúdo  
  (título + corpo). Hash exibido e usado na confirmação de aprovação.
- Botão simulado **“Enviar para Metricool Review”** (sem chamada real à API).  
  Apenas feedback visual com o hash da versão.
- Página `/fila` acessível a partir da home
- `STATUS.md` (este arquivo) com inventário

## Pendente / próximo

- Autenticação, workspaces, memberships, roles e RLS (Sprint 1)
- Backend real (Supabase) + migrações + políticas (ainda bloqueado pelas regras de Sprint 0)
- Persistência server-side da fila e auditoria
- Integração real com Metricool (somente após aprovação explícita e ambiente seguro)
- Assets, licenças, direitos e QA de conteúdo
- Calendário, canais e métricas de growth
- Finance (comissões, conciliação)
- AI Workforce com ferramentas allowlisted e kill switches
- Deploy de preview / produção (Vercel) — ainda não vinculado
- Testes automatizados além de typecheck/lint/build

## Regras respeitadas nesta entrega

- Nenhuma publicação real
- Nenhuma chamada real a Metricool
- Nenhum merge em `main`
- Nenhuma migration de host / deploy
- Segredos fora do repositório
- Hash simples apenas para matching de versão (não criptográfico)

## Como validar

```bash
npm run typecheck
npm run lint
npm run build
npm run dev   # depois abrir /fila
```

A fila persiste no `localStorage` do browser (chave `smkon-fila-v1`).  
Botão “Reiniciar demo” restaura os dados de semente.
