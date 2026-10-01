import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { verify } from "../src/commands.js";
import type { Io } from "../src/io.js";

const here = dirname(fileURLToPath(import.meta.url));
const vectorsDir = join(here, "..", "..", "..", "test", "vectors");

function captureIo(): { io: Io; lines: string[] } {
  const lines: string[] = [];
  return { io: { log: (l) => lines.push(l), error: (l) => lines.push(l) }, lines };
}

describe("qed verify", () => {
  it("exits 0 on a valid, verified receipt (vector 001)", async () => {
    const { io } = captureIo();
    const code = await verify(
      { file: join(vectorsDir, "001-valid-verified.json"), keys: join(vectorsDir, "keys.json"), json: true },
      io,
    );
    expect(code).toBe(0);
  });

  it("checks a receipt's policy against the pipeline document (vector 022) and fails a wrong digest (024)", async () => {
    const keys = join(vectorsDir, "keys.json");
    const pipeline = join(vectorsDir, "pipeline.example.json");
    const ok = captureIo();
    expect(await verify({ file: join(vectorsDir, "022-valid-policy-checked.json"), keys, pipeline }, ok.io)).toBe(0);
    expect(ok.lines).toContain("policy:     true");
    const bad = captureIo();
    expect(await verify({ file: join(vectorsDir, "024-policy-bad-digest.json"), keys, pipeline }, bad.io)).toBe(1);
    expect(bad.lines).toContain("policy:     false");
    // without the document the policy is reported as not checked, and the receipt stays valid
    const none = captureIo();
    expect(await verify({ file: join(vectorsDir, "022-valid-policy-checked.json"), keys }, none.io)).toBe(0);
    expect(none.lines).toContain("policy:     not_checked");
  });

  it("says what a change entry is, with no verdict (vector 027)", async () => {
    const { io, lines } = captureIo();
    const code = await verify(
      { file: join(vectorsDir, "027-valid-change.json"), keys: join(vectorsDir, "keys.json"), pipeline: join(vectorsDir, "pipeline.example.json") },
      io,
    );
    expect(code).toBe(0);
    expect(lines.find((l) => l.startsWith("kind:"))).toContain("change entry");
    expect(lines).toContain("verdict:    -");
  });

  it("exits 1 on a tampered receipt (vector 007)", async () => {
    const { io } = captureIo();
    const code = await verify(
      { file: join(vectorsDir, "007-tampered-verdict.json"), keys: join(vectorsDir, "keys.json"), json: true },
      io,
    );
    expect(code).toBe(1);
  });
});
