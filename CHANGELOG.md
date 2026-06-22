# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0]

Reworks the proof requirement from a decomposed OpenID4VP request the Agent assembles into a composed, Verifier-authored Digital Credentials request the Agent executes, relays, or acquires remotely. This is a breaking change to the `proof` object and the VP Artifact.

### Added

- A flat top-level payload whose `presentation_requirements` member is a composed Digital Credentials request (a `DigitalCredentialRequestOptions` value, `{ "requests": [ ... ] }`) authored by the Verifier and usable directly as the `digital` argument to `navigator.credentials.get()`. Each entry uses `protocol: "openid4vp-v1-signed"` (RECOMMENDED) or `"openid4vp-v1-unsigned"`. The x401-specific members (`oauth`, `trust_establishment`, `request_id`, `satisfied_requirements`) sit beside it at the top level.
- A "Verifier Binding" security section describing the two binding modes: a signed request (RECOMMENDED) authenticates the Verifier and pre-authorizes the invocation origin via `client_id`/`expected_origins`; an unsigned request binds to the invoking origin and the Verifier's `nonce`, enabling fulfillment at an origin the Verifier cannot declare in advance at the cost of weaker phishing/harvesting resistance.
- `trust_establishment`, a top-level string whose value is the URL of a DIF Credential Trust Establishment document, as an optional acquisition and discovery hint.
- By-reference presentation delivery: a VP Artifact MAY carry a `presentation_uri` (with optional `expires_at`) that the Verifier dereferences, instead of an inline `response`, for presentations that exceed header size limits or are generated remotely. The Verifier MUST issue a unique URI per presentation; integrity comes from normal proof validation, so no separate digest is carried. New "Presentation by Reference" subsection and `Presentation Reference` term.
- "Obtaining a Presentation" section (with a "Composed Request Invariants" subsection) describing the three ways an Agent obtains a presentation result — native DC API invocation, relay to a wallet or remote service, or fully remote generation and acquisition.
- "Agent Binding Options" informative subsection enumerating optional agent-binding mechanisms (response audience binding, Web Bot Auth / HTTP Message Signatures, mTLS, DPoP, workload identity, delegation evidence) without mandating one.
- "Verifier State and Stateless Operation" note explaining that stateless operation is achievable by encoding verifier-protected state in the OpenID4VP `nonce`, left to the implementer.
- "Consumer Client Compatibility" section framed as an early experiment for consumer AI clients and other body-only HTTP consumers, including an optional HTML `<data value="application/json;x401=proof-required" hidden>{...}</data>` carrier (with a `$schema` marker) that mirrors the route-scoped requirement for header-blind clients, and a "Remote and Out-of-Band Fulfillment" subsection describing how a remote surface can invoke the request and let the Agent acquire the result and replay the route.
- Appendix C "x401 Request Object JSON Schema" (JSON Schema 2020-12), published at `https://x401.id/spec/schemas/request.json`, covering both header-carried and body-embedded forms and requiring top-level `presentation_requirements` with `openid4vp-v1-signed` or `openid4vp-v1-unsigned` entries.

### Changed

- The Verifier now composes the presentation request; previously the Agent composed its own OpenID4VP Authorization Request and was the OpenID4VP client. With a signed request (RECOMMENDED) the Verifier is the relying party, bound via the request signature, `client_id`, and `expected_origins`; with an unsigned request the presentation binds to the invoking origin and the Verifier's `nonce`.
- The payload is flat: its members sit at the top level rather than nested under a `proof` object. The credential query (`dcql_query`), the OpenID4VP `nonce`, and the request expiry (`exp`) all live inside the request, so x401 no longer carries them itself.
- VP Artifact restructured to carry the Digital Credentials API presentation result as `response` (`{ protocol, data }`) inline or a `presentation_uri` by reference; `agent_id` is now OPTIONAL.
- VP response encryption and Agent binding are now OPTIONAL. Proof validation, token issuance, conformance, and security text were reworked so binding to the Agent is an additional, optional layer rather than a requirement.
- `trust_establishment`, `request_id`, and `satisfied_requirements` are OPTIONAL hints/optimizations: only `presentation_requirements` and `oauth` are load-bearing. `request_id`/`satisfied_requirements` support cross-route token reuse and are not inputs to proof validation or token issuance, and issuer enforcement is governed by DCQL `trusted_authorities` in the request, not by `trust_establishment`.
- "Agent-Generated Verifiable Presentation" replaced by "Obtaining a Presentation"; the W3C Digital Credentials API and the OpenID4VP DC API profile were promoted to normative references.
- Tightened the "Status Code Independence" subsection of `HTTP Semantics` to scope the `MUST` requirement for `PROOF-REQUIRED` to responses whose whole representation would be changed by fulfilling a single set of proof requirements, keeping the main protocol body focused on header-driven, whole-response gating.
- Bumped the payload, error object, and token object `version`, and the spec version, to `0.2.0`.

### Removed

- The `proof` wrapper object and the decomposed members it formerly held: `proof.presentation_protocol`, `proof.dcql_query`, `proof.scope`, `proof.challenge`, and the `proof.issuers` object (replaced by the top-level `trust_establishment` string).
- The `x401:<base64url-verifier-id>:<nonce>` Verifier Challenge value format and the normative "Verifier Challenge Construction and Correlation" rules (including the ≥128-bit nonce requirement and the two correlation models). Verifier identity now comes from the request itself (the signature and `client_id` when signed; the invoking origin when unsigned), and nonce composition is left to OpenID4VP and the implementer.
- The agent-composed OpenID4VP request construction rules and the `scope`-based payload variant.
