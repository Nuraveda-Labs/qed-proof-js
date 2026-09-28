/**
 * waitForVerdict backs off exponentially (x2 per poll, capped at 30 s) like the Python SDK, never sleeps past the
 * deadline, and honours Retry-After; generated client_claim_ids use crypto.getRandomValues when randomUUID is missing.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { githubCommitPush } from "../src/actions.js";
import { QedProof } from "../src/client.js";

function json(body: unknown, init: { status?: number; headers?: Record<string, string> } = {}): Response {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { "content-type": "application/json", ...init.headers },
  });
}
const queued = { claim_id: "c1", state: "queued", attempts: 1, receipt_id: null, verdict: null };
const decided = { claim_id: "c1", state: "decided", attempts: 2, receipt_id: "r1", verdict: "verified" };

/** Records each sleep's duration against a fake clock: a sleep advances Date.now and resolves on the next microtask. */
function recordSleeps(): number[] {
  const waits: number[] = [];
  let now = 1_000_000;
  vi.spyOn(Date, "now").mockImplementation(() => now);
  vi.spyOn(globalThis, "setTimeout").mockImplementation(((fn: () => void, ms?: number) => {
    waits.push(ms ?? 0);
    now += ms ?? 0;
    queueMicrotask(fn);
    return 0 as unknown as ReturnType<typeof setTimeout>;
  }) as typeof setTimeout);
  return waits;
}

afterEach(() => vi.restoreAllMocks());

describe("waitForVerdict backoff", () => {
  it("doubles the wait each poll", async () => {
    const waits = recordSleeps();
    let n = 0;
    const fetch = vi.fn(async () => json(++n < 5 ? queued : decided));
    const qp = new QedProof({ apiKey: "k", fetch: fetch as unknown as typeof globalThis.fetch });
    await qp.waitForVerdict("c1", { pollIntervalMs: 100, timeoutMs: 600_000 });
    expect(waits).toEqual([100, 200, 400, 800]);
  });

  it("caps the wait at 30 s", async () => {
    const waits = recordSleeps();
    let n = 0;
    const fetch = vi.fn(async () => json(++n < 8 ? queued : decided));
    const qp = new QedProof({ apiKey: "k", fetch: fetch as unknown as typeof globalThis.fetch });
    await qp.waitForVerdict("c1", { pollIntervalMs: 10_000, timeoutMs: 10_000_000 });
    expect(waits).toEqual([10_000, 20_000, 30_000, 30_000, 30_000, 30_000, 30_000]);
  });

  it("never sleeps past the deadline", async () => {
    const waits = recordSleeps();
    const fetch = vi.fn(async () => json(queued));
    const qp = new QedProof({ apiKey: "k", fetch: fetch as unknown as typeof globalThis.fetch });
    await expect(qp.waitForVerdict("c1", { pollIntervalMs: 60_000, timeoutMs: 1_000 })).rejects.toThrow(/timed out/);
    expect(Math.max(...waits)).toBeLessThanOrEqual(1_000);
  });

  it("waits at least Retry-After when rate limited", async () => {
    const waits = recordSleeps();
    let n = 0;
    const fetch = vi.fn(async () =>
      ++n === 1 ? json({ detail: "slow down" }, { status: 429, headers: { "retry-after": "7" } }) : json(decided),
    );
    const qp = new QedProof({ apiKey: "k", fetch: fetch as unknown as typeof globalThis.fetch });
    await qp.waitForVerdict("c1", { pollIntervalMs: 100, timeoutMs: 600_000 });
    expect(waits[0]).toBe(7_000);
  });
});

describe("generated client_claim_id", () => {
  it("uses crypto.getRandomValues when randomUUID is unavailable", async () => {
    const realCrypto = globalThis.crypto;
    Object.defineProperty(globalThis, "crypto", {
      configurable: true,
      value: { getRandomValues: (a: Uint8Array) => realCrypto.getRandomValues(a) },
    });
    try {
      let body: Record<string, unknown> = {};
      const fetch = vi.fn(async (_url: string, init: RequestInit) => {
        body = JSON.parse(init.body as string);
        return json({ ...queued, created: true });
      });
      const qp = new QedProof({ apiKey: "k", fetch: fetch as unknown as typeof globalThis.fetch });
      await qp.submitClaim(githubCommitPush({ target: "a/b", sha: "a".repeat(40), branch: "main" }), { agentId: "x" });
      expect(body.client_claim_id).toMatch(/^claim-\d+-[0-9a-f]{32}$/);
    } finally {
      Object.defineProperty(globalThis, "crypto", { configurable: true, value: realCrypto });
    }
  });
});
