/**
 * Conformance suite: for every entry of test/vectors/manifest.json, verifyReceipt(...) must
 * deep-equal entry.expected exactly. This is oss/sdk-js's copy of the spec's own conformance
 * vectors (synced from oss/spec/vectors — see docs/lanes/sdk-clients.md). Do not edit the vendored
 * vectors; this test only reads them.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { verifyReceipt } from "../src/verify.js";

const here = dirname(fileURLToPath(import.meta.url));
const vectorsDir = join(here, "..", "..", "..", "test", "vectors");

const manifest = JSON.parse(readFileSync(join(vectorsDir, "manifest.json"), "utf-8")) as {
  keyset: string;
  vectors: Array<{ description: string; expected: Record<string, unknown>; file: string }>;
};
const keys = JSON.parse(readFileSync(join(vectorsDir, manifest.keyset), "utf-8"));

describe("conformance vectors (poaw/0.1)", () => {
  for (const vector of manifest.vectors) {
    it(`${vector.file}: ${vector.description}`, async () => {
      const receiptText = readFileSync(join(vectorsDir, vector.file), "utf-8");
      const report = await verifyReceipt(receiptText, { keys });
      expect(report).toEqual(vector.expected);
    });
  }
});
