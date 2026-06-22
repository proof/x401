# x401

The **x401 HTTP Proof Requirement Protocol** specification.

x401 defines an HTTP-native, route-scoped protocol for requiring credential-based proof
before access to a protected resource is granted. A server (the _verifier_) advertises a
proof requirement with a `PROOF-REQUIRED` header; a user _agent_ retries with a
`PROOF-PRESENTATION` header carrying a verifiable presentation — or a reusable
proof-satisfaction token. x401 builds on DCQL, OpenID4VP, OAuth 2.0, and OpenID4VCI, and
composes with — but does not redefine — payment protocols (`402 Payment Required`).

📄 **Read the specification:** <https://x401.proof.com/spec>

## Repository layout

| Path | Purpose |
| --- | --- |
| `spec.md`, `specs.json` | Specification source ([spec-up](https://github.com/decentralized-identity/spec-up) inputs) |
| `scripts/` | Build entry points that render the spec and static site |
| `public/` | Static assets for the rendered site |
| `CHANGELOG.md` | Notable changes to the specification |

## Building locally

```
npm ci
npm run spec:dev      # live-reloading spec preview
npm run site:build    # build the static site into www/
npm test
```

## Implementations

- [`@proof.com/x401-node`](https://github.com/proof/x401-node) — Node.js SDK for verifiers and agents.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[Apache 2.0](LICENSE).
