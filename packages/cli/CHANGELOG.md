# Changelog

All notable changes to `@qed-proof/cli` are documented here. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project uses
[Semantic Versioning](https://semver.org/).

## [0.1.4] - Unreleased

### Fixed
- Depends on `@qed-proof/sdk` 0.1.4. No CLI behaviour change.

## [0.1.3] - Unreleased

Same code as 0.1.2. 0.1.2 was tagged but never published: the release job's npm was too old for trusted publishing.

## [0.1.2] - never published

### Fixed
- Depends on `@qed-proof/sdk` 0.1.2 (CSP-safe schema validation). No CLI behaviour change.

## [0.1.1] - Unreleased

The first published version. 0.1.0 was tagged on the public repo but never published.

### Fixed
- The `qed` bin is kept on publish: npm 11 dropped `"./dist/cli.cjs"` as invalid, so 0.1.0 would have installed with no command. `repository.directory` is now `packages/cli`.

## [0.1.0] - never published

### Added
- `qed login` / `qed logout`, storing the API key at mode 0600 in the OS config dir.
- `qed claim`, `qed claims list` (`--all` follows the cursor), `qed receipts get`, `qed watch`.
- `qed verify`: offline receipt check, printing signature/inclusion/anchor/verdict/trust level
  and exiting 1 when the receipt is not valid.
