# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- New top-level section "Consumer Client Compatibility" placed after "Composable Agent and Entity Identification" and before "Security Considerations". The section is explicitly framed as an early experiment in adapting x401 to consumer AI clients and other body-only HTTP consumers, with an invitation for community contributions; the core protocol remains header-driven.
- Within the new section, a subsection "Embedded Proof Requirements in HTML Content" defining an optional HTML `<data value="application/json;x401=proof-required" hidden>{...}</data>` carrier for the x401 payload on non-`401` HTML responses. The embedded JSON object MUST include a `$schema` member pointing at `https://x401.id/spec/schemas/request.json` so that AI scrapers and content processors that retain only the object can recognize it as an x401 proof requirement.
- Motivation subsection explaining that consumer-facing AI assistants from major platforms, in-document HTML rendering, and archival/syndication tooling do not reliably surface HTTP headers from successful (`2xx`) responses, and that Verifiers who want their gating requirements to reach those audiences should strongly consider the embedded carrier in addition to `PROOF-REQUIRED`.
- Placement, scope, and processing expectations clarifying that embedded `<data>` elements are informational body-side mirrors of the route-scoped requirement and that the Verifier still enforces proof through the normal `PROOF-REQUIRED` / `PROOF-PRESENTATION` exchange.
- Appendix C "x401 Request Object JSON Schema" containing a JSON Schema 2020-12 definition of the x401 proof requirement payload, published at `https://x401.id/spec/schemas/request.json`. The schema covers both header-carried and body-embedded forms of the payload, including the optional `$schema` marker and the `oneOf` constraint that exactly one of `proof.dcql_query` or `proof.scope` is present.

### Changed

- Tightened the "Status Code Independence" subsection of `HTTP Semantics` to scope the `MUST` requirement for `PROOF-REQUIRED` to responses whose whole representation would be changed by fulfilling a single set of proof requirements. The header remains the authoritative carrier for route-scoped proof requirements that gate the entire response. The main protocol body is kept exclusively focused on the header-driven, whole-response gating case; the body-embedded compatibility mechanism is described separately under "Consumer Client Compatibility".
