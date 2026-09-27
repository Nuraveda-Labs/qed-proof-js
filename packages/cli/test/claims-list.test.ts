import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { claimsList } from "../src/commands.js";
import { writeConfig } from "../src/config.js";
import type { Io } from "../src/io.js";

function captureIo(): { io: Io; lines: string[] } {
  const lines: string[] = [];
  return { io: { log: (l) => lines.push(l), error: (l) => lines.push(l) }, lines };
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
}

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "qed-cli-claims-test-"));
  process.env.QED_PROOF_CONFIG_DIR = dir;
  writeConfig({ apiKey: "qed_sk_test", baseUrl: "https://api.example.test" });
});
afterEach(() => {
  delete process.env.QED_PROOF_CONFIG_DIR;
  rmSync(dir, { recursive: true, force: true });
});

describe("qed claims list", () => {
  it("prints a compact table for a single page", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        claims: [
          { claim_id: "c1", state: "decided", attempts: 1, receipt_id: "r1", verdict: "verified" },
          { claim_id: "c2", state: "queued", attempts: 1, receipt_id: null, verdict: null },
        ],
        next_cursor: null,
      }),
    );
    const { io, lines } = captureIo();

    const code = await claimsList({ agent: "agent-1" }, io, fetchMock as unknown as typeof fetch);

    expect(code).toBe(0);
    const [url] = fetchMock.mock.calls[0] as [string];
    const parsed = new URL(url);
    expect(parsed.pathname).toBe("/v1/claims");
    expect(parsed.searchParams.get("agent_id")).toBe("agent-1");
    expect(lines.some((l) => l.includes("c1") && l.includes("decided") && l.includes("verified") && l.includes("r1"))).toBe(true);
    expect(lines.some((l) => l.includes("c2") && l.includes("queued") && l.includes("-"))).toBe(true);
  });

  it("--all follows next_cursor across pages", async () => {
    const calls: string[] = [];
    const fetchMock = vi.fn(async (url: string) => {
      calls.push(url);
      const cursor = new URL(url).searchParams.get("cursor");
      if (cursor === null) {
        return jsonResponse({
          claims: [{ claim_id: "c1", state: "decided", attempts: 1, receipt_id: "r1", verdict: "verified" }],
          next_cursor: "page2",
        });
      }
      return jsonResponse({
        claims: [{ claim_id: "c2", state: "decided", attempts: 1, receipt_id: "r2", verdict: "verified" }],
        next_cursor: null,
      });
    });
    const { io, lines } = captureIo();

    const code = await claimsList({ all: true, json: true }, io, fetchMock as unknown as typeof fetch);

    expect(code).toBe(0);
    expect(calls).toHaveLength(2);
    const parsed = JSON.parse(lines[0]) as Array<{ claim_id: string }>;
    expect(parsed.map((c) => c.claim_id)).toEqual(["c1", "c2"]);
  });
});
