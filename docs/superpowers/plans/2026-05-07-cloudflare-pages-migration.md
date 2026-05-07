# Cloudflare Pages Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up `x401.id` on Cloudflare Pages with a shared-password gate, replacing the existing CloudFront + S3 deployment of x401 in `go-to-market/publish/x401/`.

**Architecture:** Single Cloudflare Pages project, Git-connected to `github.com/proof/x401`. Build runs `npm run site:build` → `www/`. A Pages Function at `functions/_middleware.js` gates all routes via shared-password cookie. Static security headers via `_headers`. Configuration is dashboard-managed; no IaC.

**Tech Stack:** Cloudflare Pages, Pages Functions (Workers runtime), Node + npm for build, vitest for middleware tests.

**Source spec:** `docs/superpowers/specs/2026-05-07-cloudflare-pages-migration-design.md`

---

## Pre-flight

The `proof/x401` repo currently contains only `README.md`. The x401 source lives at `~/Documents/go-to-market/publish/x401/` (synced earlier from the upstream `csuwildcat/x401`). All file operations below run from the repo root unless stated.

```bash
cd ~/Documents/x401
```

---

### Task 1: Seed proof/x401 with x401 source

Copies the static-site source from go-to-market into the new repo and strips the upstream's dead WebAwesome 3.4.0 `<link>`.

**Files:**
- Create: `public/` (copied from `~/Documents/go-to-market/publish/x401/public/`)
- Create: `scripts/build-pages.mjs` (copied)
- Create: `spec.md` (copied)
- Create: `specs.json` (copied)
- Create: `package.json` (copied)
- Create: `package-lock.json` (copied)
- Modify: `public/site/index.html` — strip the dead 3.4.0 `<link>` block
- Modify: `public/demo/index.html` — strip the dead 3.4.0 `<link>` block

- [ ] **Step 1: Copy source files**

```bash
SRC=~/Documents/go-to-market/publish/x401
DEST=~/Documents/x401

cp -R "$SRC/public" "$DEST/public"
mkdir -p "$DEST/scripts"
cp "$SRC/scripts/build-pages.mjs" "$DEST/scripts/build-pages.mjs"
cp "$SRC/spec.md" "$DEST/spec.md"
cp "$SRC/specs.json" "$DEST/specs.json"
cp "$SRC/package.json" "$DEST/package.json"
cp "$SRC/package-lock.json" "$DEST/package-lock.json"
```

- [ ] **Step 2: Verify the dead link is present (so the next step has work to do)**

```bash
grep -l "early.webawesome.com/webawesome@3.4.0" \
  ~/Documents/x401/public/site/index.html \
  ~/Documents/x401/public/demo/index.html
```

Expected: both file paths print.

- [ ] **Step 3: Strip the dead `<link>` from both files**

In `~/Documents/x401/public/site/index.html`, replace this block:

```html
    <link
      rel="stylesheet"
      href="https://early.webawesome.com/webawesome@3.4.0/dist/styles/themes/default.css"
    />
    <link rel="stylesheet" href="styles.css" />
```

with:

```html
    <link rel="stylesheet" href="styles.css" />
```

Apply the same edit to `~/Documents/x401/public/demo/index.html`, but with `../styles.css` (relative path differs):

Replace:

```html
    <link
      rel="stylesheet"
      href="https://early.webawesome.com/webawesome@3.4.0/dist/styles/themes/default.css"
    />
    <link rel="stylesheet" href="../styles.css" />
```

with:

```html
    <link rel="stylesheet" href="../styles.css" />
```

- [ ] **Step 4: Verify the dead link is gone**

```bash
grep -r "early.webawesome.com/webawesome@3.4.0" ~/Documents/x401/public/ || echo "clean"
```

Expected: prints `clean`.

- [ ] **Step 5: Commit**

```bash
cd ~/Documents/x401
git add public scripts spec.md specs.json package.json package-lock.json
git commit -m "Seed x401 site source from go-to-market/publish/x401"
```

---

### Task 2: Add .gitignore

**Files:**
- Create: `.gitignore`

- [ ] **Step 1: Create .gitignore**

Write this to `~/Documents/x401/.gitignore`:

```
node_modules/
www/
.DS_Store
```

- [ ] **Step 2: Commit**

```bash
git add .gitignore
git commit -m "Ignore node_modules and build output"
```

---

### Task 3: Add _headers

Static security headers applied to all paths.

**Files:**
- Create: `_headers`

- [ ] **Step 1: Create _headers file**

Write this to `~/Documents/x401/_headers`:

```
/*
  Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.webawesome.com; style-src 'self' 'unsafe-inline' https://*.webawesome.com https://fonts.googleapis.com; img-src 'self' data: blob: https://*.webawesome.com https://*.fontawesome.com; connect-src 'self' https://api.github.com https://*.webawesome.com https://*.fontawesome.com; font-src 'self' data: https://*.webawesome.com https://fonts.gstatic.com; frame-ancestors 'none'
```

Note: Cloudflare's `_headers` format requires the path on its own line, headers indented with two spaces beneath. Each header is one line — no line wrapping for the CSP value.

- [ ] **Step 2: Commit**

```bash
git add _headers
git commit -m "Add security headers via Cloudflare _headers"
```

---

### Task 4: Add vitest as dev dependency and test script

**Files:**
- Modify: `package.json` — add `vitest` to `devDependencies`, add `test` script

- [ ] **Step 1: Install vitest**

```bash
cd ~/Documents/x401
npm install --save-dev vitest@^2
```

- [ ] **Step 2: Verify package.json now has vitest in devDependencies**

```bash
grep -A1 '"devDependencies"' ~/Documents/x401/package.json
```

Expected: lists `"vitest"` with a version.

- [ ] **Step 3: Add test script to package.json**

In `~/Documents/x401/package.json`, locate the `"scripts"` block. Add a `"test"` entry:

```json
    "test": "vitest run",
```

(Place it alphabetically among existing scripts.)

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "Add vitest for Pages Function tests"
```

---

### Task 5: Write the failing test for the password gate middleware

The middleware exports a default `onRequest({ request, next })` handler. Tests construct mock `Request` objects and assert on the returned `Response`.

**Files:**
- Create: `functions/_middleware.test.js`

- [ ] **Step 1: Create the test file**

Write this to `~/Documents/x401/functions/_middleware.test.js`:

```javascript
import { describe, it, expect, vi } from "vitest";
import { onRequest } from "./_middleware.js";

const PASSWORD = "x401-protocol-2026";
const COOKIE_NAME = "x401-gate";

function makeContext({ url, cookie, next } = {}) {
  const headers = new Headers();
  if (cookie) headers.set("Cookie", cookie);
  const request = new Request(url ?? "https://x401.id/", { headers });
  return {
    request,
    next: next ?? vi.fn(async () => new Response("origin", { status: 200 })),
  };
}

describe("password gate middleware", () => {
  it("passes through when the cookie matches", async () => {
    const ctx = makeContext({ cookie: `${COOKIE_NAME}=${PASSWORD}` });
    const res = await onRequest(ctx);
    expect(ctx.next).toHaveBeenCalledOnce();
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("origin");
  });

  it("returns the 401 splash with no cookie and no query", async () => {
    const ctx = makeContext({ url: "https://x401.id/" });
    const res = await onRequest(ctx);
    expect(ctx.next).not.toHaveBeenCalled();
    expect(res.status).toBe(401);
    expect(res.headers.get("content-type")).toMatch(/text\/html/);
    const body = await res.text();
    expect(body).toContain("<form");
    expect(body).not.toContain("Incorrect password");
  });

  it("renders the inline error when ?gate= submitted with wrong value", async () => {
    const ctx = makeContext({ url: "https://x401.id/?gate=wrong" });
    const res = await onRequest(ctx);
    expect(res.status).toBe(401);
    const body = await res.text();
    expect(body).toContain("Incorrect password");
  });

  it("redirects with Set-Cookie when ?gate= matches", async () => {
    const ctx = makeContext({ url: "https://x401.id/demo/?gate=" + PASSWORD });
    const res = await onRequest(ctx);
    expect(ctx.next).not.toHaveBeenCalled();
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/demo/");
    const setCookie = res.headers.get("set-cookie");
    expect(setCookie).toContain(`${COOKIE_NAME}=${PASSWORD}`);
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("Secure");
    expect(setCookie).toContain("SameSite=Lax");
    expect(setCookie).toContain("Path=/");
  });

  it("preserves other query params on the redirect", async () => {
    const ctx = makeContext({
      url: "https://x401.id/?gate=" + PASSWORD + "&utm_source=email",
    });
    const res = await onRequest(ctx);
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/?utm_source=email");
  });

  it("emits CSP and HSTS headers on the 401 splash", async () => {
    const ctx = makeContext({ url: "https://x401.id/" });
    const res = await onRequest(ctx);
    expect(res.headers.get("content-security-policy")).toContain("default-src 'self'");
    expect(res.headers.get("strict-transport-security")).toContain("max-age=");
    expect(res.headers.get("x-frame-options")).toBe("DENY");
  });

  it("does not pass through when cookie value does not match", async () => {
    const ctx = makeContext({ cookie: `${COOKIE_NAME}=nope` });
    const res = await onRequest(ctx);
    expect(ctx.next).not.toHaveBeenCalled();
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

```bash
cd ~/Documents/x401
npm test
```

Expected: vitest reports failure because `./_middleware.js` does not exist (`Cannot find module`).

- [ ] **Step 3: Commit the failing test**

```bash
git add functions/_middleware.test.js
git commit -m "Add failing tests for Pages Function password gate"
```

---

### Task 6: Implement the password gate middleware

Pages Functions middleware contract: default-export an async function `onRequest({ request, next, ... })` that returns a `Response` (or calls `next()` to continue to the static asset).

**Files:**
- Create: `functions/_middleware.js`

- [ ] **Step 1: Create the middleware**

Write this to `~/Documents/x401/functions/_middleware.js`:

```javascript
// Cloudflare Pages middleware: cookie-gated password splash.
//
// Replaces the browser's basic-auth popup with a styled HTML form. Same
// shared-secret model as basic auth: the expected value lives in this
// source. Suitable for preview gates, not real authentication.

const PASSWORD = "x401-protocol-2026";
const COOKIE_NAME = "x401-gate";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days
const REALM = "x401";

const SECURITY_HEADERS = {
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Content-Security-Policy":
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.webawesome.com; style-src 'self' 'unsafe-inline' https://*.webawesome.com https://fonts.googleapis.com; img-src 'self' data: blob: https://*.webawesome.com https://*.fontawesome.com; connect-src 'self' https://api.github.com https://*.webawesome.com https://*.fontawesome.com; font-src 'self' data: https://*.webawesome.com https://fonts.gstatic.com; frame-ancestors 'none'",
};

export async function onRequest(context) {
  const { request, next } = context;
  const url = new URL(request.url);

  if (readCookie(request, COOKIE_NAME) === PASSWORD) {
    return next();
  }

  const submitted = url.searchParams.get("gate");

  if (submitted === PASSWORD) {
    url.searchParams.delete("gate");
    const location = url.pathname + (url.search || "");
    const headers = new Headers({
      Location: location,
      "Cache-Control": "no-store",
      "Set-Cookie":
        `${COOKIE_NAME}=${PASSWORD}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=${COOKIE_MAX_AGE}`,
      ...SECURITY_HEADERS,
    });
    return new Response(null, { status: 302, headers });
  }

  const failed = submitted !== null;
  const body = renderGatePage({ failed });
  const headers = new Headers({
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store",
    ...SECURITY_HEADERS,
  });
  return new Response(body, { status: 401, headers });
}

function readCookie(request, name) {
  const header = request.headers.get("Cookie");
  if (!header) return null;
  for (const part of header.split(/;\s*/)) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    if (part.slice(0, eq) === name) return part.slice(eq + 1);
  }
  return null;
}

function renderGatePage({ failed }) {
  const errorMarkup = failed
    ? '<div class="err">Incorrect password.</div>'
    : '<div class="err"></div>';

  return `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${REALM}</title>
<style>
  :root{color-scheme:dark}
  body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0b0d12;color:#e8eaf0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Inter,system-ui,sans-serif}
  .gate{width:min(380px,90vw);padding:32px;border:1px solid #1f2330;border-radius:14px;background:#11141c;box-shadow:0 24px 60px rgba(0,0,0,.5)}
  .gate h1{margin:0 0 4px;font-size:22px;letter-spacing:-.01em}
  .gate p{margin:0 0 24px;color:#8a92a4;font-size:14px}
  .gate label{display:block;font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:#8a92a4;margin-bottom:8px}
  .gate input{width:100%;box-sizing:border-box;padding:12px 14px;border:1px solid #2a2f3e;border-radius:8px;background:#0b0d12;color:#e8eaf0;font-size:15px;outline:none;transition:border-color .15s}
  .gate input:focus{border-color:#6470ff}
  .gate button{width:100%;margin-top:16px;padding:12px 14px;border:0;border-radius:8px;background:#6470ff;color:#fff;font-size:15px;font-weight:600;cursor:pointer}
  .gate button:hover{background:#7480ff}
  .err{margin-top:12px;min-height:1em;color:#ff7a90;font-size:13px}
</style></head><body>
<form class="gate" method="get" autocomplete="off">
<h1>${REALM}</h1>
<p>This page is access-restricted.</p>
<label for="gate-input">Password</label>
<input id="gate-input" name="gate" type="password" autocomplete="current-password" autofocus required>
<button type="submit">Continue</button>
${errorMarkup}
</form></body></html>`;
}
```

- [ ] **Step 2: Run tests and confirm they pass**

```bash
cd ~/Documents/x401
npm test
```

Expected: all 7 tests in `functions/_middleware.test.js` pass.

- [ ] **Step 3: Commit**

```bash
git add functions/_middleware.js
git commit -m "Implement Pages Function password gate"
```

---

### Task 7: Local smoke test with wrangler

Run the site + Functions on localhost so we can manually verify the full flow before pushing.

**Files:** none

- [ ] **Step 1: Build the site once**

```bash
cd ~/Documents/x401
npm ci
npm run site:build
```

Expected: `www/` directory now contains `index.html`, `app.js`, `spec/`, etc.

- [ ] **Step 2: Install wrangler globally if not present**

```bash
which wrangler || npm install -g wrangler
```

- [ ] **Step 3: Run wrangler pages dev**

```bash
cd ~/Documents/x401
wrangler pages dev www
```

Expected: server starts on `http://localhost:8788/`. Note: `wrangler pages dev` automatically picks up `functions/` at the repo root.

- [ ] **Step 4: Manual verification (in a browser at http://localhost:8788/)**

Verify the following in order. **Do not proceed to Task 8 until every item is green.**

- [ ] Visiting `/` returns the dark splash page (not the site)
- [ ] Submitting the wrong password shows "Incorrect password." inline
- [ ] Submitting the correct password (`x401-protocol-2026`) lands on the actual site
- [ ] The home page renders fully — hero rotator works, mermaid diagram appears, the three feature icons (`arrows-split-up-and-left`, `plug`, `robot`) render
- [ ] `/demo/` loads after auth
- [ ] `/spec/` loads after auth
- [ ] Hard reload (Cmd-Shift-R) keeps you authenticated (cookie persists)
- [ ] Clearing cookies + reload returns the splash
- [ ] DevTools Console shows no CSP errors
- [ ] DevTools Network shows no blocked or 4xx requests

- [ ] **Step 5: Stop wrangler (Ctrl-C)**

No commit — this task is verification only.

---

### Task 8: Add CLOUDFLARE.md ops doc

**Files:**
- Create: `CLOUDFLARE.md`

- [ ] **Step 1: Create CLOUDFLARE.md**

Write this to `~/Documents/x401/CLOUDFLARE.md`:

````markdown
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
````

- [ ] **Step 2: Commit**

```bash
git add CLOUDFLARE.md
git commit -m "Document Cloudflare Pages setup and rotation"
```

---

### Task 9: Push to GitHub and create the Pages project

**Files:** none — Cloudflare dashboard work.

- [ ] **Step 1: Push to GitHub**

```bash
cd ~/Documents/x401
git push origin main
```

- [ ] **Step 2: Create the Pages project (Cloudflare dashboard)**

1. Open `https://dash.cloudflare.com/`
2. Workers & Pages → Create → Pages → Connect to Git
3. Authorize Cloudflare for `proof` GitHub org if prompted
4. Select repository: `proof/x401`
5. Set up builds and deployments:
   - Project name: `x401`
   - Production branch: `main`
   - Framework preset: `None`
   - Build command: `npm run site:build`
   - Build output directory: `www`
   - Root directory: (leave blank — repo root)
   - Environment variables: none
6. Click **Save and Deploy**

- [ ] **Step 3: Wait for the first deploy to complete**

Watch the build log in the dashboard. Expected: `Success: Assets published!`. Note the auto-generated URL (looks like `https://x401.pages.dev` or `https://<hash>.x401.pages.dev`).

- [ ] **Step 4: Verify the preview deploy**

Open the `*.pages.dev` URL in a fresh incognito window and run the same manual verification checklist from Task 7, Step 4. **Do not proceed to Task 10 until every item is green.**

---

### Task 10: Bind the x401.id custom domain

**Files:** none — Cloudflare dashboard work.

- [ ] **Step 1: Add the custom domain**

1. Cloudflare dashboard → Workers & Pages → `x401` project → Custom domains
2. Click **Set up a custom domain**
3. Enter `x401.id`
4. Cloudflare detects that the zone is on the same account and offers to create the DNS record automatically. Confirm.
5. Wait for the cert and record provisioning to complete (typically <1 minute).

- [ ] **Step 2: Verify x401.id end-to-end**

Open `https://x401.id/` in a fresh incognito window. Run the same verification checklist from Task 7, Step 4. Plus:

- [ ] TLS cert is valid and issued by Cloudflare
- [ ] HTTP redirects to HTTPS (Cloudflare does this by default, but confirm)

**Do not proceed to Task 11 until every item is green and the new site has been live and working for at least 24 hours.**

---

### Task 11: Cutover — tear down CloudFront x401

After x401.id has been verified live and stable, remove the old CloudFront stack from `go-to-market`.

**Files:**
- Modify: `~/Documents/go-to-market/publish/cloudfront.tf` — remove the `module "cloudfront_x401"` block
- Modify: `~/Documents/go-to-market/Jenkinsfile` — remove the `Deploy x401 site` stage
- Delete: `~/Documents/go-to-market/publish/x401/` (entire directory)

- [ ] **Step 1: Create a branch**

```bash
cd ~/Documents/go-to-market
git checkout -b infra/retire-cloudfront-x401
```

- [ ] **Step 2: Remove the x401 module from cloudfront.tf**

Open `~/Documents/go-to-market/publish/cloudfront.tf` and delete the entire `module "cloudfront_x401" { ... }` block (everything after the marketing module). The file should end with the closing `}` of the marketing module.

- [ ] **Step 3: Remove the x401 deploy stage from the Jenkinsfile**

Open `~/Documents/go-to-market/Jenkinsfile` and delete the entire `stage('Deploy x401 site') { ... }` block. The remaining stages should be `Checkout` and `Deploy marketing site`.

- [ ] **Step 4: Delete publish/x401/**

```bash
rm -rf ~/Documents/go-to-market/publish/x401
```

- [ ] **Step 5: Empty the x401 S3 bucket so terraform can destroy it**

```bash
aws s3 rm s3://marketing-x401-assets --recursive
```

Expected: lists deleted objects, exits 0. (If the bucket is already empty, this is a no-op.)

- [ ] **Step 6: Run tofu plan**

```bash
cd ~/Documents/go-to-market/publish
tofu plan
```

Expected output (summarized): destroys the x401 distribution, S3 bucket, ACM cert, password-gate function, and security headers policy. **Crucially, no destructive changes to the marketing distribution.**

- [ ] **Step 7: Apply**

```bash
tofu apply
```

Expected: all x401 resources destroyed. Marketing distribution untouched.

- [ ] **Step 8: Commit and PR**

```bash
cd ~/Documents/go-to-market
git add publish/cloudfront.tf Jenkinsfile publish/x401
git commit -m "Retire CloudFront x401 stack — site moved to Cloudflare Pages"
git push -u origin infra/retire-cloudfront-x401
gh pr create --title "Retire CloudFront x401 stack" --body "$(cat <<'EOF'
## Summary
- Removes the x401 module from publish/cloudfront.tf
- Removes the x401 deploy stage from the Jenkinsfile
- Deletes publish/x401/

## Why
x401 is now served from Cloudflare Pages at https://x401.id (proof/x401 repo, Pages project).
The CloudFront distribution, S3 bucket, ACM cert, and password-gate function are no longer needed.

## Test plan
- [x] tofu plan reviewed: only x401 resources destroyed, marketing untouched
- [x] tofu apply succeeded; x401 resources removed
- [x] https://x401.id verified live and working before this PR

EOF
)"
```

- [ ] **Step 9: Merge after review**

Once approved, merge into `main`. Marketing site continues deploying via the existing Jenkins pipeline.

---

## Verification checklist (post-merge)

- [ ] `https://x401.id/` is live, gated, and functional
- [ ] Cloudflare dashboard shows healthy build history for `x401` project
- [ ] `tofu state list` in `go-to-market/publish` no longer contains any `module.cloudfront_x401.*` resources
- [ ] `aws s3 ls s3://marketing-x401-assets` returns "NoSuchBucket"
- [ ] No references to `publish/x401` remain in `go-to-market`

```bash
cd ~/Documents/go-to-market
grep -r "x401" publish/ Jenkinsfile 2>/dev/null || echo "clean"
```

Expected: prints `clean`.
