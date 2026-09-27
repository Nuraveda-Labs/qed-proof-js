import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { claim } from "../src/commands.js";
import { writeConfig } from "../src/config.js";
import type { Io } from "../src/io.js";

function captureIo(): { io: Io; lines: string[] } {
  const lines: string[] = [];
  return { io: { log: (l) => lines.push(l), error: (l) => lines.push(l) }, lines };
}

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "qed-cli-claim-test-"));
  process.env.QED_PROOF_CONFIG_DIR = dir;
  writeConfig({ apiKey: "qed_sk_test", baseUrl: "https://api.example.test" });
});
afterEach(() => {
  delete process.env.QED_PROOF_CONFIG_DIR;
  rmSync(dir, { recursive: true, force: true });
});

describe("qed claim", () => {
  it("builds the right request for github.commit.push", async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const fetchMock = vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return new Response(JSON.stringify({ claim_id: "c1", created: true, state: "queued", attempts: 1, receipt_id: null, verdict: null }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });

    const { io } = captureIo();
    const code = await claim(
      {
        action: "github.commit.push",
        target: "acme/widgets",
        param: [`sha=${"a".repeat(40)}`, "branch=main"],
        agent: "agent-1",
        id: "deploy-42",
      },
      io,
      fetchMock as unknown as typeof fetch,
    );

    expect(code).toBe(0);
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("https://api.example.test/v1/claims");
    const body = JSON.parse(calls[0].init.body as string);
    expect(body).toMatchObject({
      client_claim_id: "deploy-42",
      agent_id: "agent-1",
      action: "github.commit.push",
      target: "acme/widgets",
      params: { sha: "a".repeat(40), branch: "main" },
    });
  });
});
