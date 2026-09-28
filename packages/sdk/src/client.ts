/**
 * The HTTP client. Shapes follow `oss/node/src/poaw_node/app.py`, `models.py` (`ClaimIn`) and
 * `store.py` (`claim_status`). Uses only `fetch` — no Node built-ins — so it runs on Node, Deno
 * and in browsers.
 */
import type { ClaimAction } from "./actions.js";
import { QedProofError, RateLimitError } from "./errors.js";
import { RECEIPT_TEXT, verifyReceipt, type VerifyReport } from "./verify.js";
import type { Keyset } from "./anchor.js";

export interface QedProofOptions {
  apiKey?: string;
  baseUrl?: string;
  fetch?: typeof fetch;
}

export interface SubmitClaimOptions {
  agentId: string;
  clientClaimId?: string;
  claimedAt?: string | Date;
}

export interface ClaimStatus {
  claim_id: string;
  created?: boolean;
  state: "queued" | "decided";
  attempts: number;
  receipt_id: string | null;
  verdict: string | null;
}

export interface WaitOptions {
  timeoutMs?: number;
  pollIntervalMs?: number;
}

export interface Receipt {
  body: Record<string, unknown>;
  signature: Record<string, unknown>;
  proof?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface ClaimSummary {
  claim_id: string;
  state: string;
  attempts: number;
  receipt_id: string | null;
  verdict: string | null;
}

export interface ListClaimsOptions {
  limit?: number;
  cursor?: string;
  agentId?: string;
  action?: string;
  verdict?: string;
  state?: string;
}

export interface ClaimPage {
  claims: ClaimSummary[];
  nextCursor: string | null;
}

const LIST_CLAIMS_DEFAULT_LIMIT = 50;
const LIST_CLAIMS_MIN_LIMIT = 1;
const LIST_CLAIMS_MAX_LIMIT = 200;

const DEFAULT_BASE_URL = "https://api.qedproof.site";

function isoNow(): string {
  return new Date().toISOString();
}

export class QedProof {
  private readonly apiKey?: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: QedProofOptions = {}) {
    this.apiKey = options.apiKey;
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
    const f = options.fetch ?? globalThis.fetch;
    if (!f) {
      throw new Error("QedProof: no fetch implementation available; pass { fetch } explicitly");
    }
    // Call fetch as a plain function, never as a method of this client: browsers throw "Illegal invocation" when
    // fetch's `this` isn't the window (Node doesn't care, so 0.1.0-0.1.3 worked in Node and failed in every browser).
    this.fetchImpl = (input, init) => f(input, init);
  }

  private async request(
    method: string,
    path: string,
    { auth = true, body, text = false }: { auth?: boolean; body?: unknown; text?: boolean } = {},
  ): Promise<unknown> {
    const headers: Record<string, string> = { accept: "application/json" };
    if (body !== undefined) headers["content-type"] = "application/json";
    if (auth) {
      if (!this.apiKey) {
        throw new QedProofError(401, "no API key configured");
      }
      headers["authorization"] = `Bearer ${this.apiKey}`;
    }
    let res: Response;
    try {
      res = await this.fetchImpl(`${this.baseUrl}${path}`, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    } catch (exc) {
      // Never let a network failure leak the key: the message here never includes `this.apiKey`.
      throw new QedProofError(0, `network error: ${exc instanceof Error ? exc.message : String(exc)}`);
    }

    if (res.status === 429) {
      const retryAfterHeader = res.headers.get("retry-after");
      const retryAfter = retryAfterHeader ? Number(retryAfterHeader) : undefined;
      let detail = "rate limit exceeded";
      try {
        const parsed = (await res.json()) as { detail?: string };
        if (parsed?.detail) detail = parsed.detail;
      } catch {
        // ignore body parse failure, keep default detail
      }
      throw new RateLimitError(detail, Number.isFinite(retryAfter) ? retryAfter : undefined);
    }

    if (!res.ok) {
      let detail = res.statusText;
      try {
        const parsed = (await res.json()) as { detail?: string };
        if (parsed?.detail) detail = parsed.detail;
      } catch {
        // ignore body parse failure, keep statusText
      }
      throw new QedProofError(res.status, detail);
    }

    if (res.status === 204) return undefined;
    if (text) return res.text();
    return res.json();
  }

  async submitClaim(claim: ClaimAction, options: SubmitClaimOptions): Promise<ClaimStatus> {
    const claimedAt = options.claimedAt instanceof Date ? options.claimedAt.toISOString() : (options.claimedAt ?? isoNow());
    const body = {
      client_claim_id: options.clientClaimId ?? cryptoRandomId(),
      agent_id: options.agentId,
      action: claim.action,
      target: claim.target,
      params: claim.params,
      claimed_at: claimedAt,
    };
    return (await this.request("POST", "/v1/claims", { body })) as ClaimStatus;
  }

  async getClaim(claimId: string): Promise<ClaimStatus> {
    return (await this.request("GET", `/v1/claims/${encodeURIComponent(claimId)}`)) as ClaimStatus;
  }

  async waitForVerdict(claimId: string, options: WaitOptions = {}): Promise<ClaimStatus> {
    const timeoutMs = options.timeoutMs ?? 120_000;
    const pollIntervalMs = options.pollIntervalMs ?? 2_000;
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      let wait = pollIntervalMs;
      try {
        const status = await this.getClaim(claimId);
        if (status.state === "decided") return status;
      } catch (exc) {
        if (exc instanceof RateLimitError && exc.retryAfter !== undefined) {
          wait = Math.max(wait, exc.retryAfter * 1000);
        } else {
          throw exc;
        }
      }
      if (Date.now() >= deadline) {
        throw new QedProofError(408, `timed out after ${timeoutMs}ms waiting for claim ${claimId} to decide`);
      }
      await sleep(Math.min(wait, Math.max(0, deadline - Date.now())));
    }
  }

  /**
   * `GET /v1/claims`, newest first. `options.limit` (1-200, default 50) is validated locally —
   * out of range throws a `RangeError` before any request is made.
   */
  async listClaims(options: ListClaimsOptions = {}): Promise<ClaimPage> {
    const limit = options.limit ?? LIST_CLAIMS_DEFAULT_LIMIT;
    if (limit < LIST_CLAIMS_MIN_LIMIT || limit > LIST_CLAIMS_MAX_LIMIT) {
      throw new RangeError(`limit must be between ${LIST_CLAIMS_MIN_LIMIT} and ${LIST_CLAIMS_MAX_LIMIT}, got ${limit}`);
    }
    const query: Record<string, string> = { limit: String(limit) };
    if (options.cursor !== undefined) query.cursor = options.cursor;
    if (options.agentId !== undefined) query.agent_id = options.agentId;
    if (options.action !== undefined) query.action = options.action;
    if (options.verdict !== undefined) query.verdict = options.verdict;
    if (options.state !== undefined) query.state = options.state;
    const qs = new URLSearchParams(query).toString();
    const data = (await this.request("GET", `/v1/claims?${qs}`)) as { claims: ClaimSummary[]; next_cursor: string | null };
    return { claims: data.claims, nextCursor: data.next_cursor };
  }

  /** Yields every claim matching the filters, following `nextCursor` until exhausted. */
  async *iterClaims(options: Omit<ListClaimsOptions, "cursor" | "limit"> & { pageSize?: number } = {}): AsyncGenerator<ClaimSummary> {
    const { pageSize, ...filters } = options;
    let cursor: string | undefined;
    for (;;) {
      const page = await this.listClaims({ ...filters, limit: pageSize, cursor });
      yield* page.claims;
      if (page.nextCursor === null) return;
      cursor = page.nextCursor;
    }
  }

  /** Receipts are designed to be shared and checked by anyone (SPEC §1): no Authorization header. */
  async getReceipt(receiptId: string): Promise<Receipt> {
    const text = (await this.request("GET", `/v1/receipts/${encodeURIComponent(receiptId)}`, { auth: false, text: true })) as string;
    const receipt = JSON.parse(text) as Receipt;
    RECEIPT_TEXT.set(receipt as object, text);
    return receipt;
  }

  /** Public by design: `/.well-known/poaw-keys.json` (SPEC §5.2, §8.4). */
  async getKeys(): Promise<Keyset> {
    return (await this.request("GET", "/.well-known/poaw-keys.json", { auth: false })) as Keyset;
  }

  async verify(receipt: unknown | string, options: { keys?: Keyset; rpcUrl?: string } = {}): Promise<VerifyReport> {
    const keys = options.keys ?? (await this.getKeys());
    return verifyReceipt(receipt, { keys, rpcUrl: options.rpcUrl });
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function cryptoRandomId(): string {
  const g = globalThis as { crypto?: { randomUUID?: () => string } };
  if (g.crypto?.randomUUID) return g.crypto.randomUUID();
  return `claim-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
