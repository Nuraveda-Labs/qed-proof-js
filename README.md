# qed-proof-js

TypeScript SDK and CLI for [QED Proof](https://qedproof.site): independent verification of AI
agents' claimed work. Submit a claim, poll for a verdict, and verify a signed PoAW receipt
offline — the same receipt verifies identically in Python, TypeScript and the reference
`check.py` checker.

This is an npm workspace with two published packages:

| Package | npm | What |
|---|---|---|
| [`packages/sdk`](packages/sdk) | [`@qed-proof/sdk`](https://www.npmjs.com/package/@qed-proof/sdk) | The TypeScript SDK: `QedProof` client, `verifyReceipt`, action helpers. Runs on Node ≥ 18, Deno and in browsers. |
| [`packages/cli`](packages/cli) | [`@qed-proof/cli`](https://www.npmjs.com/package/@qed-proof/cli) | The `qed` command-line tool. Depends on `@qed-proof/sdk`. |

## Why it's self-contained

`test/vectors/` and `src/receipt.schema.json` at this directory's root are **byte copies**,
synced from the private monorepo's `oss/spec/` (see `docs/lanes/sdk-clients.md`). Nothing here
imports from outside this directory — everything a package needs is vendored in.

## Develop

```bash
npm install
npm run build
npm test
```

`packages/sdk`'s build first copies `src/receipt.schema.json` into its own `src/generated/`
(see `packages/sdk/scripts/copy-schema.mjs`) and can regenerate TypeScript types from it with
`npm run gen:types` (see `packages/sdk/scripts/gen-types.mjs`); the committed output is checked
for drift by `packages/sdk/test/generated-types.test.ts`.

## Conformance

Every one of `test/vectors/manifest.json`'s 20 vectors must verify to *exactly* the recorded
`expected` report. `packages/sdk/test/conformance.test.ts` asserts this; `packages/sdk/test/anchor.test.ts`
ports the reference checker's fake-chain anchor tests.

## License

Apache-2.0. See [LICENSE](LICENSE).
