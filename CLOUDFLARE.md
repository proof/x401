# Cloudflare Pages Build Notes

The marketing site for x401 lives in a separate repository. This repo only keeps
the protocol specification, tests, and local demo source.

If this repo is deployed directly, the build produces a static `www` directory
containing the generated spec and a small demo landing page.

## Build settings

- Build command: `npm run site:build`
- Build output directory: `www`
- Root directory: (repo root)

## Components

- `functions/_middleware.js` — shared-password gate, cookie-based
- `_headers` — security headers copied into `www` during the build
- `public/demo/` — local demo source and informational demo landing page
- `scripts/build-pages.mjs` — spec/demo build entrypoint
- `spec.md` + `specs.json` — spec-up inputs
- `www/` — generated build output, ignored by git

## Rotating the password

1. Edit `PASSWORD` at the top of `functions/_middleware.js`
2. Update the same value in `functions/_middleware.test.js`
3. `npm test` to confirm tests pass
4. Commit and push — the deployment target rebuilds if this repo is connected
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
