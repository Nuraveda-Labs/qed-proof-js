# Changelog

All notable changes to `@qed-proof/cli` are documented here. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project uses
[Semantic Versioning](https://semver.org/).

## [0.1.0] - Unreleased

### Added
- `qed login` / `qed logout`, storing the API key at mode 0600 in the OS config dir.
- `qed claim`, `qed claims list` (`--all` follows the cursor), `qed receipts get`, `qed watch`.
- `qed verify`: offline receipt check, printing signature/inclusion/anchor/verdict/trust level
  and exiting 1 when the receipt is not valid.
