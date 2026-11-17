# SMKON — Architecture Decisions

## Current baseline

- Application: Next.js App Router with TypeScript.
- Hosting target: Vercel.
- Data platform target: Supabase (Postgres, Auth, RLS, Storage).
- Repository: `smklj/smkon`.
- Product scope: private Control Center for product intelligence, content rights, growth, finance and controlled AI operations.

## Non-negotiable controls

1. No production publishing without approval of the exact content version and matching content hash.
2. No asset distribution without validated rights/licensing and applicable disclosure.
3. No spending, paid media, purchases, subscriptions, hiring or transfers without explicit Owner approval.
4. Keep secrets out of Git, client bundles, logs and generated artifacts.
5. Use least-privilege access, audit trails, idempotency and bounded retries.
6. Do not bypass platform APIs, terms, rate limits or eligibility requirements.

## Delivery sequence

- Sprint 0: application foundation, CI and preview deployment.
- Sprint 1: authentication, workspaces, memberships, roles, RLS and audit log.
- Sprint 2: product and offer intelligence.
- Sprint 3: content lifecycle, assets, licenses, QA and approvals.
- Sprint 4: channel operations, calendar and metrics.
- Sprint 5: commission tracking and financial reconciliation.
- Sprint 6: controlled AI workforce with allowlisted tools and kill switches.

## Sprint 0 constraints

No production data, no live publishing, no paid infrastructure, and no Supabase schema changes until their migrations and access policies are reviewed.
