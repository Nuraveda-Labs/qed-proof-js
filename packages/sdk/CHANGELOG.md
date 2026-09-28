# Changelog

All notable changes to `@qed-proof/sdk` are documented here. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project uses
[Semantic Versioning](https://semver.org/).

## [0.1.5] - Unreleased

### Changed
- `waitForVerdict` backs off exponentially (x2 per poll, capped at 30 s), matching the Python SDK. It still never sleeps past `timeoutMs` and still honours `Retry-After`.
- A generated `client_claim_id` uses `crypto.getRandomValues` when `crypto.randomUUID` is unavailable, before falling back to `Math.random`.

## [0.1.4] - Unreleased

### Fixed
- Works in browsers: `QedProof` now calls `fetch` as a plain function. 0.1.0–0.1.3 called it as a method of the client, which browsers reject with "Illegal invocation" (Node accepts it).

## [0.1.3] - Unreleased

Same code as 0.1.2. 0.1.2 was tagged but never published: the release job's npm was too old for trusted publishing.

## [0.1.2] - never published

### Fixed
- Works under a strict Content-Security-Policy (no `'unsafe-eval'`). The receipt schema is now precompiled at build time (ajv standalone), so importing the SDK no longer generates code with `new Function`; 0.1.1 threw at import in such pages. `ajv` and `ajv-formats` are no longer runtime dependencies.

## [0.1.1] - Unreleased

The first published version. 0.1.0 was tagged on the public repo but never published.

### Fixed
- `repository.directory` is now `packages/sdk` (it said `packages/packages`).

## [0.1.0] - never published

### Added
- `QedProof` client: `submitClaim`, `getClaim`, `waitForVerdict`, `listClaims`, `iterClaims`,
  `getReceipt`, `getKeys`, `verify`.
- `verifyReceipt`: a full port of `check.py` + `anchor_check.py` + `poaw_core`'s primitives
  (JCS, Ed25519, Merkle inclusion, JSON Schema validation, EAS anchor check over JSON-RPC).
- `actions.*` typed helpers for the five live actions plus `http.url.status`.
- `QedProofError`, `RateLimitError`.
- Types generated from the vendored `receipt.schema.json`.
