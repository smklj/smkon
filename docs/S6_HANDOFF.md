# S6 — Segurança e observabilidade

**Branch:** `feature/s6-security-observability` → PR para `feature/smkon-production-readiness`

## O que mudou

| Área | Mudança | Arquivos |
|---|---|---|
| Headers | Em todas as respostas: CSP de base (só scripts/conexões próprios e do Supabase; `frame-ancestors 'none'`, `object-src 'none'`, `base-uri` e `form-action` restritos), `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy` (câmera, microfone, localização e pagamento desligados), COOP e HSTS | `src/lib/http/security-headers.ts`, `next.config.ts` |
| Rate limit | Tabela `rate_limit_buckets` (fechada para a API) + `rate_limit_consume(scope, subject)`. Escopos e limites fixos no banco: login por IP (30/15 min), login por e-mail (10/15 min), criação de convites (30/h por usuário), aceite (20/h por usuário). Login usa só o SHA-256 do IP e do e-mail; escopos autenticados usam `auth.uid()` e ignoram o sujeito enviado | `supabase/migrations/20261118210000_rate_limits.sql` |
| Login | Limite por IP e por e-mail antes de chamar o Supabase Auth (o servidor chama o Supabase sempre do mesmo IP, então o limite por IP do Auth não protege contra força bruta via app). Mensagem "Muitas tentativas" | `src/app/login/*`, `src/lib/http/rate-limit.ts` |
| Convites | 429 com `Retry-After` ao criar convites em excesso; limite no aceite | `src/app/api/invitations/route.ts`, `src/app/(app)/convite/actions.ts` |
| Logs | `log(level, scope, fields)`: JSON em uma linha, campos sensíveis (`token`, `password`, `secret`, `cookie`, `authorization`, `api_key`, `hash`) substituídos por `[redacted]`. Todos os `console.*` do app migrados | `src/lib/observability/log.ts` e chamadores |

## Decisões e limites
- **CSP com `'unsafe-inline'` em scripts:** o App Router usa scripts inline. CSP com nonce exige renderização dinâmica em todas as rotas e um ajuste no Proxy; fica como evolução. A CSP atual já bloqueia scripts de terceiros, iframes e plugins.
- **Fail-open do rate limit:** se a função não existir ou o banco falhar, a tentativa é liberada e um erro é registrado, para não derrubar o login. Com a migration aplicada, o limite é efetivo.
- **Bloqueio de conta por terceiros:** quem souber um e-mail pode esgotar o limite por e-mail daquela conta por 15 minutos. É a troca usual entre força bruta e negação de acesso. O limite por IP reduz o abuso.

## Testes executados (Claude Code, 18/11/2026)

| Suíte | Resultado |
|---|---|
| `npm run test:db` (7 arquivos, inclui `007_rate_limits`) | ✅ 172 afirmações |
| `npm run test:unit` | ✅ 37/37 (CSP, headers, redação de logs, hash do sujeito, IP do cliente) |
| Sintaxe TS/TSX | ✅ 0 erros |
| typecheck / lint / build / headers no Preview | CI e Preview do PR |

Correção durante os testes: o teste 2a chamava a função num `LATERAL` sem referência à linha, e o Postgres a executava uma vez só. O teste foi corrigido; a função estava certa.

## Pendências
- 🔐 Aplicar `20261118210000_rate_limits.sql` no Supabase `smkonlj` e alinhar a versão.
- CSP com nonce (remover `'unsafe-inline'` de scripts).
- Envio dos logs para um destino externo (drain/Sentry): exige conta e plano.
