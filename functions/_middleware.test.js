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
