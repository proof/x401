# Contributing

Thanks for your interest in x401. This repository holds the protocol specification and a
small local demo of the [x401 HTTP Proof Requirement Protocol](https://x401.proof.com/spec).

## Requirements

- Node.js (current LTS)
- npm

## Getting started

```
npm ci
npm run spec:dev      # live-reloading spec preview
npm run site:build    # build the static site into www/
npm test              # run the test suite
```

## Scope

x401 defines HTTP proof-requirement semantics only. Please keep changes within that boundary:

- The protocol is header-driven (`PROOF-REQUIRED`, `PROOF-PRESENTATION`, `PROOF-RESPONSE`).
- x401 composes with, but does not redefine, payment protocols — payment stays on
  `402 Payment Required`.
- Credential formats and wallet transport (OpenID4VP request construction) are out of scope
  for the core protocol.

## Pull requests

- Fork the repo and branch off of `main`.
- For substantive protocol changes, open an issue first so the approach can be discussed.
- Include a clear title and description explaining what changed and why.
- Keep changes focused — try to limit one issue or feature per PR.
- Record user-facing spec changes in [CHANGELOG.md](CHANGELOG.md).

## Code of conduct

This project follows the
[Contributor Covenant Code of Conduct](https://www.contributor-covenant.org/version/2/1/code_of_conduct/).
By participating, you are expected to uphold this standard.
