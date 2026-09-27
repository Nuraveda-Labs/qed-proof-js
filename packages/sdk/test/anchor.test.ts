/**
 * Ports oss/spec/tests/test_anchor_check.py's fake-chain cases: every mismatch fails, and only a
 * fully matching attestation passes. Injects a fetch mock in place of a real JSON-RPC endpoint.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { checkAnchor, type Proof, type Keyset } from "../src/anchor.js";
import { sha256, b64u, b64uDecode } from "../src/primitives.js";

const ATTESTER = "0x23a848B41db0f152b7B9811e8314B6531dFAe523";
const SCHEMA = new Uint8Array(32).fill(0x5c);
const LOG = sha256(new TextEncoder().encode("log"));
const ROOT = sha256(new TextEncoder().encode("root"));
const UID = new Uint8Array(32).fill(0x77);

function hex(bytes: Uint8Array): string {
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function word(n: bigint | number): string {
  return BigInt(n).toString(16).padStart(64, "0");
}

function wordFromBytes(bytes: Uint8Array): string {
  return hex(bytes).padStart(64, "0");
}

function addressWord(addr: string): string {
  const clean = addr.startsWith("0x") ? addr.slice(2) : addr;
  return clean.toLowerCase().padStart(64, "0");
}

function boolWord(b: boolean): string {
  return word(b ? 1 : 0);
}

/** ABI-encodes _DATA = (bytes32,uint64,bytes32,uint64,bytes32,string) with a trailing string. */
function encodeData(logId: Uint8Array, size: bigint, root: Uint8Array, prevSize: bigint, prevRoot: Uint8Array, specVersion: string): string {
  const strBytes = new TextEncoder().encode(specVersion);
  const strLen = strBytes.length;
  const strWords = Math.ceil(strLen / 32) || 1;
  const strPadded = new Uint8Array(strWords * 32);
  strPadded.set(strBytes);
  const head = [wordFromBytes(logId), word(size), wordFromBytes(root), word(prevSize), wordFromBytes(prevRoot), word(6 * 32)].join("");
  const tail = word(strLen) + hex(strPadded);
  return head + tail;
}

/** ABI-encodes _ATT = (bytes32,bytes32,uint64,uint64,uint64,bytes32,address,address,bool,bytes) with trailing bytes `data`. */
function encodeAttestation(opts: {
  uid: Uint8Array;
  schema: Uint8Array;
  time: bigint;
  exp?: bigint;
  revokedAt?: bigint;
  ref?: Uint8Array;
  recipient?: string;
  attester: string;
  revocable?: boolean;
  data: string; // hex, no 0x
}): string {
  const dataBytes = Buffer.from(opts.data, "hex");
  const dataLen = dataBytes.length;
  const dataWords = Math.ceil(dataLen / 32) || 1;
  const dataPadded = new Uint8Array(dataWords * 32);
  dataPadded.set(dataBytes);
  const head = [
    wordFromBytes(opts.uid),
    wordFromBytes(opts.schema),
    word(opts.time),
    word(opts.exp ?? 0n),
    word(opts.revokedAt ?? 0n),
    wordFromBytes(opts.ref ?? new Uint8Array(32)),
    addressWord(opts.recipient ?? "0x" + "00".repeat(20)),
    addressWord(opts.attester),
    boolWord(opts.revocable ?? false),
    word(10 * 32),
  ].join("");
  const tail = word(dataLen) + hex(dataPadded);
  return head + tail;
}

/** Wraps a single dynamic tuple as a top-level eth_call return value: offset word + tuple bytes. */
function wrapReturn(tupleHex: string): string {
  return "0x" + word(32) + tupleHex;
}

function chain(overrides: Partial<{
  chainId: number;
  uid: Uint8Array;
  schema: Uint8Array;
  attester: string;
  revoked: bigint;
  time: bigint;
  log: Uint8Array;
  size: bigint;
  root: Uint8Array;
}> = {}) {
  const o = {
    chainId: 84532,
    uid: UID,
    schema: SCHEMA,
    attester: ATTESTER,
    revoked: 0n,
    time: 1790000000n,
    log: LOG,
    size: 9n,
    root: ROOT,
    ...overrides,
  };
  const data = encodeData(o.log, o.size, o.root, 5n, new Uint8Array(32), "poaw/0.1");
  const att = encodeAttestation({ uid: o.uid, schema: o.schema, time: o.time, revokedAt: o.revoked, attester: o.attester, data });
  return async (_url: string, init: RequestInit) => {
    const body = JSON.parse(init.body as string) as { method: string };
    const result =
      body.method === "eth_chainId" ? "0x" + o.chainId.toString(16) : wrapReturn(att);
    return new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, result }), { status: 200 });
  };
}

const PROOF: Proof = {
  log_id: b64u(LOG),
  tree_size: 9,
  root_hash: b64u(ROOT),
  leaf_index: 0,
  inclusion: [],
  anchor: { chain: "eip155:84532", scheme: "eas", uid: "0x" + hex(UID), tx_hash: "0x" + "11".repeat(32), tree_size: 9 },
};
const KEYS: Keyset = { anchor_addresses: [ATTESTER], anchor_schemas: ["0x" + hex(SCHEMA)] };

let originalFetch: typeof fetch;

beforeEach(() => {
  originalFetch = globalThis.fetch;
});
afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("checkAnchor (fake chain)", () => {
  it("matching attestation is anchored, with proven_by", async () => {
    globalThis.fetch = vi.fn(chain()) as unknown as typeof fetch;
    const r = await checkAnchor(PROOF, KEYS, "http://rpc");
    expect(r).toEqual({ ok: true, reason: "anchored", proven_by: 1790000000 });
  });

  it.each([
    ["rpc_chain_mismatch", { chainId: 8453 }],
    ["attester_not_published", { attester: "0x" + "12".repeat(20) }],
    ["schema_not_published", { schema: new Uint8Array(32).fill(0x01) }],
    ["log_or_size_mismatch (log)", { log: sha256(new TextEncoder().encode("other log")) }],
    ["root_mismatch", { root: sha256(new TextEncoder().encode("forged")) }],
  ] as const)("every mismatch fails: %s", async (reason, overrides) => {
    globalThis.fetch = vi.fn(chain(overrides as Record<string, unknown>)) as unknown as typeof fetch;
    const r = await checkAnchor(PROOF, KEYS, "http://rpc");
    expect(r.ok).toBe(false);
    expect(r.proven_by).toBeNull();
    expect(r.reason.startsWith(reason.split(" ")[0])).toBe(true);
  });

  it("attestation_not_found (zero uid, zero time)", async () => {
    globalThis.fetch = vi.fn(chain({ uid: new Uint8Array(32), time: 0n })) as unknown as typeof fetch;
    const r = await checkAnchor(PROOF, KEYS, "http://rpc");
    expect(r).toEqual({ ok: false, reason: "attestation_not_found", proven_by: null });
  });

  it("attestation_revoked", async () => {
    globalThis.fetch = vi.fn(chain({ revoked: 1790000001n })) as unknown as typeof fetch;
    const r = await checkAnchor(PROOF, KEYS, "http://rpc");
    expect(r).toEqual({ ok: false, reason: "attestation_revoked", proven_by: null });
  });

  it("log_or_size_mismatch (size)", async () => {
    globalThis.fetch = vi.fn(chain({ size: 10n })) as unknown as typeof fetch;
    const r = await checkAnchor(PROOF, KEYS, "http://rpc");
    expect(r).toEqual({ ok: false, reason: "log_or_size_mismatch", proven_by: null });
  });

  it("rpc failure is unproven, not proven", async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new Error("network down");
    }) as unknown as typeof fetch;
    const r = await checkAnchor(PROOF, KEYS, "http://rpc");
    expect(r.ok).toBe(false);
    expect(r.reason.startsWith("unreadable:")).toBe(true);
  });

  it("differing sizes without a consistency proof fail", async () => {
    globalThis.fetch = vi.fn(chain()) as unknown as typeof fetch;
    const proof = { ...PROOF, tree_size: 12 };
    const r = await checkAnchor(proof, KEYS, "http://rpc");
    expect(r.reason).toBe("consistency_proof_required");
  });
});
