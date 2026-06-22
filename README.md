# x401

**x401** is an HTTP-based, route-scoped **proof requirement protocol**: it lets a server require credential-based proof — proving personhood, residency, accreditation, membership, entitlement, organizational standing, or other attributes — before granting access to a protected resource, in a way that automated agents and AI clients can satisfy.

It fills a gap in HTTP. `401 Unauthorized` / `WWW-Authenticate` handle authentication, and `402 Payment Required` handles payment, but there is no general, machine-readable way to express *"present a qualifying credential to proceed."* x401 defines that, while staying deliberately separate from payment (`402` and a payment protocol still handle that).

## How it works

x401 is a header protocol carried over three dedicated fields:

- **`PROOF-REQUIRED`** — the Verifier advertises the proof requirement as a base64url-encoded JSON payload.
- **`PROOF-PRESENTATION`** — the Agent returns the presentation result (inline or by reference) on retry.
- **`PROOF-RESPONSE`** — the Verifier reports x401-specific results, including errors.

The payload's core is a **composed, Verifier-authored [Digital Credentials API](https://www.w3.org/TR/digital-credentials/) request** (an [OpenID4VP](https://openid.net/specs/openid-4-verifiable-presentations-1_0-final.html) request over the DC API) carried in its `presentation_requirements` member — usable directly as `navigator.credentials.get({ digital: payload.presentation_requirements })`. The request is normally **signed** (making the Verifier the relying party), so it can be:

1. **invoked natively** by the Agent through the Digital Credentials API,
2. **relayed** to a web wallet or a remote presentation service, or
3. **fulfilled out-of-band** (e.g. a verifier-hosted page) and the result acquired by the Agent.

The Agent then retries the original route with the presentation result. A typical flow:

```
Agent ──▶ GET /protected                      (no proof)
Verifier ─▶ 401 + PROOF-REQUIRED: <payload>    (composed signed DC request)
Agent ──▶ obtain a presentation for the request (native / relay / remote)
Agent ──▶ GET /protected + PROOF-PRESENTATION: <result or reference>
Verifier ─▶ 200 OK                             (proof validated)
```

A signed request binds the proof to the Verifier and is recommended; an **unsigned** request is also allowed for cases where the request must be fulfilled at an origin the Verifier can't know in advance (it binds to the invoking origin and the request nonce instead, with weaker phishing resistance). VP response encryption and binding the proof to a specific Agent are both **optional**. An optional OAuth 2.0 token-exchange leg lets an Agent trade a verified presentation for a short-lived, reusable token.

The normative specification lives in **[`spec.md`](spec.md)** and is published at **<https://x401.id>**.

## Building the spec locally

The spec is authored in [`spec.md`](spec.md) and rendered to HTML with [spec-up](https://github.com/decentralized-identity/spec-up).

**Prerequisites:** Node.js 18+ (developed on Node 24).

```sh
npm install          # install dependencies
npm run spec:render  # render spec.md → www/spec/
```

Then open `www/spec/index.html` in a browser. For the most reliable rendering of assets, serve the output with any static file server, e.g.:

```sh
npx serve www/spec
```

While editing, use the watch mode to regenerate on every save:

```sh
npm run spec:dev
```

To produce the full deployable site (adds the root redirect, `_headers`, and `_redirects`):

```sh
npm run site:build
```

## Contributing

Issues and pull requests are welcome. The spec is a working draft, and the **Open Questions & Future Additions** section of [`spec.md`](spec.md) lists areas where proposals, examples, interop profiles, and reference implementations are especially wanted.

## License

Licensed under the [Apache License 2.0](LICENSE).
