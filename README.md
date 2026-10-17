# Craftura Fine Furniture — GitHub Pages edition

Static Next.js 14 site. No server, no database: everything is pre-rendered to plain HTML by `next build` and hosted on GitHub Pages.

## Deploy (one time)
1. Create a GitHub repo and push this folder to the `main` branch.
2. Repo → **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. Push to `main` (or run the workflow manually from the **Actions** tab). The site appears at  
   `https://<user>.github.io/<repo>/` (or at the root if the repo is named `<user>.github.io`).

The workflow (`.github/workflows/deploy.yml`) detects the repo name and sets the base path automatically.
Custom domain? Add it in Settings → Pages and set `NEXT_PUBLIC_BASE_PATH` to empty in the workflow.

## Run locally
```bash
npm install
npm run dev                         # http://localhost:3000
npm run build && npm start          # test the static output in ./out
```

## Editing content
All content lives in `data/*.json` (products, product-images, categories, blog-posts, testimonials, gallery, site-content). Edit, commit, push — the site rebuilds.
The WhatsApp number is in `.env.production` (`NEXT_PUBLIC_WHATSAPP_NUMBER`).

## What changed from the full-stack version
| Before | Now |
|---|---|
| Prisma + SQLite | JSON files in `data/` read at build time (`lib/data.ts`) |
| Admin panel, login, API routes | Removed (GitHub Pages can't run server code) |
| Contact / bulk / order / inquiry-cart forms saved to DB + email | Open a pre-filled WhatsApp message |
| Order tracking page | Removed (needs a database) |
| Product / blog filtering on the server | Done in the browser (`?category=`, `?search=`) |
| Blog view counter | Removed |
"# kitchena-store" 
