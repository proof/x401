# Cloudflare Pages migration for x401

**Date:** 2026-05-07
**Status:** Approved, ready for implementation plan
**Repo:** `github.com/proof/x401`
**Domain:** `x401.id` (zone already on Cloudflare)

## Goal

Stand up `x401.id` on Cloudflare Pages with a shared-password gate, replacing the existing CloudFront + S3 deployment of x401 that lives in `go-to-market/publish/x401/`. After cutover, retire the CloudFront stack.

## Architecture

Single Cloudflare Pages project, Git-connected to `github.com/proof/x401`. Every push to `main` triggers a build (`npm run site:build` → `www/`) and deploys. A Pages Function at `/functions/_middleware.js` runs before every static-asset match and gates all routes with a shared-password cookie. CSP and other security headers are set via `_headers`. Configuration is dashboard-managed; no Terraform.

## Components

### 1. Pages project

- **Project name:** `x401`
- **Production branch:** `main`
- **Build command:** `npm run site:build`
- **Build output directory:** `www`
- **Root directory:** repo root
- **Connected repo:** `github.com/proof/x401`

### 2. `/functions/_middleware.js`

Single middleware at the repo root. Pages auto-detects and runs it before every request.

Behavior:

1. **Cookie present and valid** (`x401-gate` value === expected) → call `next()` (serve static asset)
2. **`?gate=<value>` query, value matches** → respond 302 with `Set-Cookie` header (`x401-gate=<value>; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=2592000`), `Location` set to current path with `gate` stripped
3. **Otherwise** → respond 401 with the styled HTML splash page (dark theme, password input, inline error message if `?gate=` was submitted with a wrong value)

Implementation ports the cookie/gate logic from the existing CloudFront Function template at `go-to-market/terraform/cloudfront/functions/password-gate.js.tftpl`. Pages Functions use Workers runtime APIs (`Request`, `Response`, `next()`) instead of CloudFront's `event.request` / `event.response`, but the control flow is identical.

### 3. `/_headers`

Static-response headers. Applied to all paths (`/*`):

- `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.webawesome.com; style-src 'self' 'unsafe-inline' https://*.webawesome.com https://fonts.googleapis.com; img-src 'self' data: blob: https://*.webawesome.com https://*.fontawesome.com; connect-src 'self' https://api.github.com https://*.webawesome.com https://*.fontawesome.com; font-src 'self' data: https://*.webawesome.com https://fonts.gstatic.com; frame-ancestors 'none'`

These are the same allowances we settled on for CloudFront after debugging WebAwesome / Font Awesome / Google Fonts blocks.

**Middleware-generated responses:** Cloudflare's `_headers` only reliably applies to static responses, not to responses returned from a Pages Function. The 401 HTML splash and the 302 redirect from `_middleware.js` therefore set the same security headers (`Content-Security-Policy`, `Strict-Transport-Security`, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`) directly on their own `Response` objects.

### 4. Custom domain

`x401.id` (apex) bound to the Pages project via the dashboard. Cloudflare provisions the TLS cert and creates the necessary DNS record automatically because the zone is already on Cloudflare.

### 5. Repo file layout

```
~/Documents/x401/
├── functions/
│   └── _middleware.js          # password gate
├── public/                      # site source (from current go-to-market/publish/x401/public)
│   ├── site/
│   ├── demo/
│   └── ...
├── scripts/
│   └── build-pages.mjs          # existing static-site build
├── _headers                     # security headers
├── package.json
├── package-lock.json
├── spec.md
├── specs.json
├── README.md
├── CLOUDFLARE.md                # short ops doc: dashboard settings, password rotation, etc.
└── docs/
    └── superpowers/
        └── specs/
            └── 2026-05-07-cloudflare-pages-migration-design.md
```

## Data flow

1. **First visit:** request → `_middleware.js` → no matching cookie → returns 401 HTML form
2. **Form submit:** GET `?gate=<password>` → `_middleware.js` → password matches → 302 with `Set-Cookie` and clean `Location`
3. **Followed redirect:** browser re-requests with cookie → `_middleware.js` → cookie matches → `next()` → static asset served from build output
4. **Subresources:** CSS/JS/images carry the cookie automatically and pass through identically

## Configuration

- **Password value:** hardcoded in `_middleware.js`. Rotation = edit + push to `main`.
- **Cookie attributes:** `Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=2592000` (30 days)
- **Initial password:** `x401-protocol-2026` (matches current CloudFront gate; rotate after cutover)

## Testing strategy

- **Local:** `wrangler pages dev` runs both the static site and Functions on `localhost:8788`. Manual smoke test of the gate, all top-level pages, and asset loading.
- **Preview deploys:** every branch push gets a `*.pages.dev` URL. Verify gate, every top-level route, mermaid diagrams, WebAwesome icons, GitHub repo metadata fetch, and spec page rendering before merging.
- **Production:** after first deploy on `main`, manually verify `x401.id` end-to-end.

## Cutover plan

1. Seed `proof/x401` with the current x401 source (copy from `go-to-market/publish/x401/`)
2. Add `functions/_middleware.js`, `_headers`, `CLOUDFLARE.md`, `.gitignore` (`node_modules/`, `www/`)
3. Push to `main`
4. Create Pages project in Cloudflare dashboard, connect to `proof/x401`, configure build
5. Verify the auto-generated `*.pages.dev` preview URL works end-to-end (gate + every page + every external dep)
6. Bind `x401.id` custom domain in the Pages project; wait for cert provisioning
7. Verify `https://x401.id/` end-to-end
8. **After verification holds for at least one day:** in `go-to-market`, remove `module "cloudfront_x401"` from `publish/cloudfront.tf`, delete `publish/x401/`, remove the x401 stage from `Jenkinsfile`. `tofu apply` to tear down the CloudFront distribution, S3 bucket, and CF Functions.

## Out of scope

- Anything beyond a shared-password gate (real auth, SSO, per-user accounts) — covered separately if/when it matters
- IaC / Terraform — explicit decision to dashboard-manage
- Migration of the spec authoring workflow (still happens in this same repo)
- Anything happening on the upstream `csuwildcat/x401` repo
