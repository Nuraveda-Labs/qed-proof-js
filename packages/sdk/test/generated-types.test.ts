/**
 * Regenerates packages/sdk/src/generated/receipt.ts in memory from the vendored schema and
 * compares it byte for byte with the committed file. Drift fails.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { generate } from "../scripts/gen-types.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const committedPath = join(here, "..", "src", "generated", "receipt.ts");

describe("generated receipt types", () => {
  it("matches a fresh regeneration from src/receipt.schema.json", async () => {
    const fresh = await generate();
    const committed = readFileSync(committedPath, "utf-8");
    expect(fresh).toEqual(committed);
  });
});
