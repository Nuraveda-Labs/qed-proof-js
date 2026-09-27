# Changelog

All notable changes to `@qed-proof/sdk` are documented here. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project uses
[Semantic Versioning](https://semver.org/).

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
