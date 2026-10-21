# Security and functionality verification

## Inspected implementation

- [`app/admin/page.tsx`](./app/admin/page.tsx) is the Arabic RTL admin UI. Supabase Auth establishes a cookie-backed session; catalog reads and mutations use the app's `/api/admin/*` endpoints rather than direct browser database or Storage writes.
- [`lib/admin/authorize.ts`](./lib/admin/authorize.ts) calls Supabase `auth.getUser()` on each protected request, checks `public.admin_users`, and rejects mutations whose `Origin` differs from the request origin.
- [`app/api/admin/products/route.ts`](./app/api/admin/products/route.ts) protects catalog listing and create/update. It validates request data, executes the `admin_save_product` RPC through the authenticated anon-key client, and invalidates `storefront-catalog` after successful writes.
- [`app/api/admin/products/[id]/route.ts`](./app/api/admin/products/[id]/route.ts) validates admin access before deleting a product and invalidates the same cache tag on success.
- [`app/api/admin/product-images/route.ts`](./app/api/admin/product-images/route.ts) validates admin access, product ID, MIME type, and 10 MiB upload size before accessing Storage. The image cleanup route restricts paths to the specified product directory.
- [`lib/supabase/server.ts`](./lib/supabase/server.ts) and [`lib/supabase/client.ts`](./lib/supabase/client.ts) create cookie-aware server and browser clients using only the public URL and anon key. No service-role key is used by the app.
- [`lib/storefront/catalog.ts`](./lib/storefront/catalog.ts) loads only published products and caches the server-side catalog under `storefront-catalog`; if both Supabase variables are absent it uses the checked-in JSON catalog, and if only one is configured or Supabase errors it fails instead of silently falling back.
- [`supabase/migrations/20261018000000_admin_storefront.sql`](./supabase/migrations/20261018000000_admin_storefront.sql) retains Postgres RLS for products, images, categories, and admin membership, plus admin-only Storage upload/update/delete. `admin_save_product` runs as invoker and is executable only by authenticated users.
- [`next.config.js`](./next.config.js) no longer configures static export. The GitHub Actions workflow now runs CI checks and does not deploy.

The admin page being hidden is not an authorization boundary: every API handler applies server-side checks, while Supabase RLS/Storage policies are defense in depth. Local source-contract tests can inspect these controls but cannot prove the policies installed in a remote Supabase project.

The checked-in schema matches the current server authorization query: `admin_users.user_id` is a UUID primary key referencing `auth.users.id`, and its RLS policy permits an authenticated user to select their own allow-list row only when `public.is_admin()` is true. `public.is_admin()` checks `auth.uid()` and is granted to authenticated users; the product-save RPC is invoker-security and only executable by authenticated users. Initial administrator enrollment therefore requires an operator to create an Auth user and add that exact UUID through the Supabase SQL Editor. There is no public sign-up/admin-promotion flow. The migration also configures the `product-images` public bucket (10 MiB maximum, JPEG/PNG/WebP) and admin-only object writes.

## npm advisory review and patch status

The prior npm audit identified nine affected package groups (11 advisory entries): Next.js, Tailwind CSS, PostCSS, `braces`, `chokidar`, `fast-glob`, `micromatch`, `postcss-nested`, and `postcss-selector-parser`.

- **Next.js 14.2.35 — critical/high.** The advisory set included critical remote-code-execution issues (including Windows-hosted server and AVIF image-optimizer cases) and high-impact Server Components, request, and cache issues. The original Next.js 14 line did not have a release covering the full set. This project moved to **Next.js 15.5.28**, a major-version upgrade, and retains React 18/App Router. The Next 15 asynchronous dynamic-route params API is used. npm's full remediation proposal was Next.js 16.4.2, which would be another major upgrade; the installed 15.5.28 version had passed `npm audit` with zero findings in the earlier verification before the current runtime-hosting edits. Re-run the audit against the present lockfile before release.
- **Tailwind CSS 3.4.4 and `braces` ≤3.0.3 — high.** A compatible patched `braces` release was not available on the original Tailwind 3 dependency path. The project migrated to **Tailwind CSS 4.3.3** and `@tailwindcss/postcss` 4.3.3. This is a major-version change; the CSS entry point, PostCSS plugin, and dark-mode configuration were updated.
- **PostCSS — high/moderate.** The affected tree included PostCSS 8.4.31 and the advisory fix range begins above 8.5.22. The project pins PostCSS to **8.5.30** with an npm override so nested consumers resolve to the patched version.
- **Tailwind transitive packages.** The audited dependency paths included affected versions of `chokidar`, `fast-glob`, `micromatch`, `postcss-nested` (through 6.2.0), and `postcss-selector-parser` (before 7.1.6). Tailwind 4 replaces the original affected dependency path; `npm audit` on the current lockfile must confirm the resolved graph.

Do not treat the historical zero-finding audit as proof of the current dependency tree. `npm audit` is part of the required release checks. Any new major upgrade needed to remediate a current advisory should be reviewed for compatibility, not suppressed.

## Automated verification and what it means

`npm test` runs:

- local source-contract tests for API authorization/origin checks, cache invalidation, RLS declarations, server-only secret handling, runtime rendering, and removal of static-export/publish-function assumptions;
- a built browser JavaScript scan when `.next/static` exists;
- a gated live integration test, which skips without all test credentials and a running app.

The source-contract tests are **local assertions, not mocked HTTP behavior or remote authorization proofs**. The live integration test loads `.env.local`, then contacts the configured Supabase project and running app. It covers anonymous and non-admin 401/403 denials, cross-origin mutation rejection, direct non-admin RPC/Storage denial, invalid image upload rejection, allow-listed admin upload and product create/update/delete, database/Storage persistence and cleanup, public catalog and product-page visibility, and post-mutation cache invalidation.

Set the following variables for a disposable staging/test project and a running local or staging Next.js server:

| Variable | Required value |
|---|---|
| `SUPABASE_SECURITY_TEST_URL` | Supabase project URL |
| `SUPABASE_SECURITY_TEST_ANON_KEY` | Public anon/publishable key for that project |
| `SUPABASE_SECURITY_TEST_ADMIN_EMAIL` / `SUPABASE_SECURITY_TEST_ADMIN_PASSWORD` | Dedicated admin test user, already present in `public.admin_users` |
| `SUPABASE_SECURITY_TEST_USER_EMAIL` / `SUPABASE_SECURITY_TEST_USER_PASSWORD` | Dedicated authenticated user not present in `public.admin_users` |
| `SUPABASE_SECURITY_TEST_APP_URL` | Base URL of the running app, e.g. `http://localhost:3000` |

The app itself also needs `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`; their values must target the same project as the test URL/key. Apply the migration and ensure at least one category exists. Start the app (for example `npm run dev`), then run `npm run test:supabase` in another terminal. Do not use production accounts or content: the test creates and deletes a test product and image. It does not deploy the app or invoke a deployment service.

## Storefront updates, fallback, and limitations

With both Supabase public variables configured, storefront routes use the server-side catalog and show published database content. Saving a product or deleting it invalidates the `storefront-catalog` Next cache tag after the database mutation succeeds; cache revalidation is request-time and does not require a redeployment. The public catalog API responds `no-store` but reads from that tagged server cache. With neither variable configured, checked-in JSON data is used; partial configuration and remote query errors fail explicitly.

Local JSON fallback/build checks do not establish real Supabase connectivity, Auth, RLS, Storage, persistence, or deployed-host cache behavior. Those runtime behaviors remain **unverified until the live integration test passes against the intended host and Supabase project**. No Supabase credentials were available during this review. No site deployment was run, and production readiness is **not claimed**.
