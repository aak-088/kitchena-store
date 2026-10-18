# KITCHENA

KITCHENA is an Arabic, right-to-left furniture storefront and admin dashboard built with Next.js 15, React 18, TypeScript, Tailwind CSS 4, and Supabase. It runs as a Next.js server application; it is not a static export. Product changes use runtime cache invalidation and do not require a redeployment.

## Local development

```powershell
npm install
Copy-Item .env.example .env.local
npm run dev
```

Without Supabase app variables, the public storefront uses the checked-in JSON catalog and `/admin` cannot authenticate. Configure `.env.local` before running the Supabase-backed app. `.env.local` is git-ignored; do not commit it or paste credentials into chat.

## Create and configure Supabase

1. Create a new Supabase project in the Supabase dashboard. Choose the intended region and save the database password in a password manager. The app does not need the database password.
2. Under **Authentication → URL Configuration**, set the local Site URL to `http://localhost:3000`. Add `http://localhost:3000/**` to Redirect URLs for account invitation/confirmation flows. Add the eventual production origin and its allowed redirect pattern only when the domain is known.
3. Under **Authentication → Settings**, disable public sign-ups. Admin and test accounts should be created by an operator from the dashboard; users must not be able to register themselves as admins.
4. Apply the repository's migration from the project root. Install/use the Supabase CLI through `npx` and enter any requested CLI credentials only in the local CLI prompt:
   ```powershell
   npx supabase init
   npx supabase login
   npx supabase link --project-ref YOUR_PROJECT_REF
   npx supabase db push
   npx supabase migration list --linked
   ```
   This workspace has the migration directory but no Supabase CLI `config.toml`, so `supabase init` is needed once to create the local CLI config; keep the existing migration file and review any CLI prompt before confirming an overwrite. `YOUR_PROJECT_REF` is the project reference shown in the Supabase dashboard URL/settings. This repository currently has one migration: [`supabase/migrations/20261018000000_admin_storefront.sql`](./supabase/migrations/20261018000000_admin_storefront.sql). It creates `admin_users`, categories, products, product images, the admin-check and save functions, RLS policies, the `product-images` Storage bucket and its policies, and starter categories/products/images. Confirm `migration list` shows the migration applied. Do not separately create a duplicate bucket or replace the migration's policies manually.
5. Verify in **Storage → Buckets** that `product-images` exists, is public for image delivery, and restricts uploads to JPG/JPEG, PNG, and WebP with a 10 MiB maximum. The migration establishes those settings. The public bucket means anyone can fetch an object if they know its URL; only allow-listed admins can upload, update, or delete objects.
6. Create the first administrator in **Authentication → Users** using **Add user** or **Invite user**. Use a dedicated, strong password and complete email confirmation if enabled. Copy that Auth user's UUID (not the password) and add it from **SQL Editor**:
   ```sql
   insert into public.admin_users (user_id)
   values ('PASTE_AUTH_USER_UUID_HERE');
   ```
   This operator-only SQL Editor step is how the first admin is allow-listed; the app intentionally has no self-service signup or admin-promotion endpoint. Verify the row's `user_id` equals the Auth user's UUID. Never insert an email or password into `admin_users`.
7. For live integration tests, create a second dedicated Auth user and do **not** add that user's UUID to `admin_users`. Confirm both users can sign in (confirm email if required). Make sure at least one category exists; the migration seeds six.

## Environment variables and key handling

Copy `.env.example` to `.env.local` and fill the values locally:

| Variable(s) | Classification | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Public | Project URL used by browser and server Supabase clients. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public | Supabase anon/publishable API key. This is intentionally browser-visible; RLS is the data authorization boundary. |
| `NEXT_PUBLIC_SITE_URL` | Public | Canonical site URL used for metadata. Use `http://localhost:3000` locally. |
| `NEXT_PUBLIC_WHATSAPP_NUMBER` | Public | Optional storefront contact number. |
| `SUPABASE_SECURITY_TEST_URL` | Local test config | Same project URL used by the live test. |
| `SUPABASE_SECURITY_TEST_ANON_KEY` | Local test config; public key | Same anon/publishable key used by the live test. |
| `SUPABASE_SECURITY_TEST_ADMIN_EMAIL`, `SUPABASE_SECURITY_TEST_ADMIN_PASSWORD` | **Local test secrets** | Dedicated allow-listed test admin credentials. |
| `SUPABASE_SECURITY_TEST_USER_EMAIL`, `SUPABASE_SECURITY_TEST_USER_PASSWORD` | **Local test secrets** | Dedicated authenticated non-admin test credentials. |
| `SUPABASE_SECURITY_TEST_APP_URL` | Local test config | Base URL of the running app, normally `http://localhost:3000`. |

The integration test loads `.env.local` using the Next.js environment loader. Restart the app after editing environment values. Keep test account passwords only in the ignored local environment file or a secret manager; never commit them or expose them in a `NEXT_PUBLIC_*` variable.

**Never configure a Supabase `service_role` key, secret API key, database password, or admin password in this application.** The current code uses only the public anon/publishable key. Vercel deployment variables, when that phase is approved, must contain only the same public app configuration; there is no service-role requirement.

## Authentication and data authorization

The admin page signs in using Supabase Auth and the cookie-aware browser client. Each protected server API request independently calls Supabase `auth.getUser()`, checks the authenticated UUID against `public.admin_users`, and returns 401 for missing sessions or 403 for authenticated non-admins. Mutations also require a same-origin `Origin` header. Product writes use the authenticated Supabase client and `admin_save_product`; Postgres RLS and Storage policies enforce the allow-list again. Hiding `/admin` is not considered authorization.

## Run the real Supabase integration test

Use a disposable Supabase project and the two dedicated users described above. Do not run this destructive test against production data: it creates and deletes a product and image.

1. Fill the public app variables and the `SUPABASE_SECURITY_TEST_*` values in `.env.local`. All URL/key values must point to the **same** Supabase project; the two test accounts must have the described allow-list status.
2. In one PowerShell window, start the app:
   ```powershell
   npm run dev
   ```
3. In a second PowerShell window in this repository, run:
   ```powershell
   npm run test:supabase
   ```
4. A passing run verifies anonymous and non-admin API denials, same-origin enforcement, non-admin RLS/RPC and Storage denial, invalid-image rejection, admin image upload, product create/update/delete persistence, image cleanup, published content in the public catalog and product page, and visibility changes after cache invalidation.

`npm test` also runs local source-contract checks. Those local assertions are **not** substitutes for the live integration test. If the live test fails, preserve its actual assertion/error output, fix the underlying setup or code issue, and rerun it; a skipped test is not a pass. See [`SECURITY-VERIFICATION.md`](./SECURITY-VERIFICATION.md).

## Runtime catalog behavior

With both public Supabase variables set, storefront routes read published content from Supabase through the server catalog cache. Product create/update/delete invalidates the `storefront-catalog` tag. The `/api/storefront/products` endpoint and product detail routes can be checked immediately after mutations. With neither variable set, the storefront uses checked-in `data/*.json`; partial Supabase configuration or query errors fail explicitly rather than silently returning stale fallback content.

The admin dashboard manages products and images. Blog posts, testimonials, gallery items, and other copy remain in checked-in JSON.

## Verification and deployment status

Run the checks:

```powershell
npm test
npm run build
npm audit
```

The repository's GitHub Actions workflow runs CI only; it does not deploy. Vercel preparation is a separate follow-up after the live Supabase integration test passes. **Do not deploy until explicitly approved.** No production readiness claim is made from a build or local tests alone.
"# kitchena-st" 
