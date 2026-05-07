# Cloudflare Pages — x401.id

This site is served by Cloudflare Pages, Git-connected to `github.com/proof/x401`.
Pushes to `main` auto-deploy.

## Project settings (Cloudflare dashboard)

- Project name: `x401`
- Production branch: `main`
- Build command: `npm run site:build`
- Build output directory: `www`
- Root directory: (repo root)
- Custom domain: `x401.id`

## Components

- `functions/_middleware.js` — shared-password gate, cookie-based
- `_headers` — security headers (CSP, HSTS, etc.) for static responses
- `public/` + `scripts/build-pages.mjs` — site source + build entrypoint
- `spec.md` + `specs.json` — spec-up inputs

## Rotating the password

1. Edit `PASSWORD` at the top of `functions/_middleware.js`
2. Update the same value in `functions/_middleware.test.js`
3. `npm test` to confirm tests pass
4. Commit and push to `main` — Cloudflare rebuilds and deploys
5. Existing browsers retain the old cookie until cleared. The cookie value is the password, so old cookies stop working immediately on the new deploy.

## Local development

```bash
npm ci
npm run site:build
wrangler pages dev www
```

Visit `http://localhost:8788/`. Login with the password in `functions/_middleware.js`.

## Tests

```bash
npm test
```

Runs vitest against `functions/_middleware.test.js`.
