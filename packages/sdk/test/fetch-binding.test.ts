/**
 * Browsers require fetch to be called with the window (or undefined) as `this`, and throw "Illegal invocation"
 * otherwise. 0.1.0–0.1.3 stored globalThis.fetch on the client and called `this.fetchImpl(...)`, which Node accepts and
 * every browser rejects. Found live on the public receipt page, 2026-09-28.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { QedProof } from "../src/client.js";

const realFetch = globalThis.fetch;

/** A fetch that behaves like a browser's: it refuses to be called as a method of some other object. */
function browserLikeFetch(calls: string[]) {
  return function fetch(this: unknown, input: RequestInfo | URL): Promise<Response> {
    if (this !== undefined && this !== globalThis) {
      return Promise.reject(new TypeError("Failed to execute 'fetch' on 'Window': Illegal invocation"));
    }
    calls.push(String(input));
    return Promise.resolve(new Response(JSON.stringify({ keys: [] }), { status: 200 }));
  } as typeof fetch;
}

afterEach(() => {
  globalThis.fetch = realFetch;
  vi.restoreAllMocks();
});

describe("fetch binding", () => {
  it("the default (global) fetch is called as a plain function", async () => {
    const calls: string[] = [];
    globalThis.fetch = browserLikeFetch(calls);
    const qp = new QedProof({ baseUrl: "https://api.example.test" });
    await qp.getKeys();
    expect(calls).toEqual(["https://api.example.test/.well-known/poaw-keys.json"]);
  });

  it("a fetch passed in options is called as a plain function too", async () => {
    const calls: string[] = [];
    const qp = new QedProof({ baseUrl: "https://api.example.test", fetch: browserLikeFetch(calls) });
    await qp.getKeys();
    expect(calls).toHaveLength(1);
  });
});
