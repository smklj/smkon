# Sprint 1 — Auth and tenant foundation

## Implemented in this branch

- Cookie-based Supabase SSR clients for browser and server contexts.
- Next.js 16 `proxy.ts` session refresh and protected-route gate.
- Password sign-in, account creation and PKCE callback exchange.
- Environment-variable example using the publishable key only in browser code.
- Tenant-safe composite foreign keys for sales adjustments and external-event references.
- pgTAP structural, RLS and two-tenant isolation checks.

## Required Preview environment

Configure these variables in Vercel Preview before functional testing:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_SITE_URL`

Never put a Supabase secret/service-role key in a `NEXT_PUBLIC_*` variable or browser bundle.

## Supabase Auth dashboard

1. Enable the Email provider.
2. Set Site URL to the deployed Preview URL.
3. Add the Preview URL and `http://localhost:3000/auth/callback` to allowed redirect URLs.
4. Decide whether email confirmation is required (recommended).
5. Test sign-up, confirmation, sign-in, refresh and invalid credentials.

## Important operational boundaries

- The proxy intentionally allows the app to render when Supabase environment variables are absent; this prevents an unconfigured Preview from crashing. Authentication is not enforced until these variables are configured.
- This branch does not apply migrations to the hosted Supabase project.
- Organization bootstrap and membership creation remain a separate transactional workflow. A successful Auth signup does not initialize a workspace.
- The ledger's polymorphic `source_table/source_id` pair is not a database-enforced foreign key yet. Add source-specific integrity enforcement before production reconciliation.

## Verification still required

Run the migration and pgTAP suite against a disposable local Supabase stack. Configure Preview environment variables and perform the Auth flow tests. A passing Next.js build alone does not prove RLS or authentication behavior.
