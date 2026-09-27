# @qed-proof/cli

`qed`: submit claims, watch verdicts and verify [QED Proof](https://qedproof.site) receipts from
the terminal. Built on [`@qed-proof/sdk`](../sdk).

## Install

```bash
npm install -g @qed-proof/cli
```

## Commands

```bash
qed login                 # prompts for the API key without echoing it (or: qed login --key-stdin)
qed logout

qed claim <action> --target T [--param k=v ...] [--agent ID] [--id CLIENT_ID] [--wait] [--json]
qed claims list [--limit N] [--agent ID] [--action A] [--verdict V] [--state S] [--all] [--json]
qed receipts get <id> [--json]
qed watch <claim-id> [--json]

qed verify <file|https-url> [--keys file|url] [--rpc url] [--json]   # offline check, exit 1 if not valid
```

`QED_PROOF_API_KEY` and `QED_PROOF_BASE_URL` env vars override the saved config.

## Config

The API key is stored at mode `0600` in the OS config directory (never printed — only the last
4 characters, masked):

| OS | Path |
|---|---|
| macOS | `~/Library/Application Support/qed-proof/config.json` |
| Linux | `$XDG_CONFIG_HOME/qed-proof/config.json` or `~/.config/qed-proof/config.json` |
| Windows | `%APPDATA%\qed-proof\config.json` |

## License

Apache-2.0. See [LICENSE](LICENSE).
