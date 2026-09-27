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

  it("exits 1 on a tampered receipt (vector 007)", async () => {
    const { io } = captureIo();
    const code = await verify(
      { file: join(vectorsDir, "007-tampered-verdict.json"), keys: join(vectorsDir, "keys.json"), json: true },
      io,
    );
    expect(code).toBe(1);
  });
});
