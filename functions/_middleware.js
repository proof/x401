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
