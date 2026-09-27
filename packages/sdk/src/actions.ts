/**
 * Typed helpers for the five live actions plus `http.url.status`, matching the wire shape the
 * node's verifiers expect (`oss/spec/profiles/*.md`, `oss/node/src/poaw_node/verifiers/*.py`).
 * Validation here is cheap and local — it never calls the network — but it fails fast with a
 * clear message before the claim is submitted, since params are copied into public receipts.
 */

export interface ClaimAction {
  action: string;
  target: string;
  params: Record<string, unknown>;
}

const REPO_RE = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const SHA_RE = /^[0-9a-f]{40}$/;
const HANDLE_RE = /^@[A-Za-z0-9_]{1,15}$/;
const POST_ID_RE = /^[0-9]{1,20}$/;
const HEX64_RE = /^[0-9a-f]{64}$/;
const SLACK_TARGET_RE = /^slack:\/\/(T[A-Z0-9]{2,20})\/([CG][A-Z0-9]{2,20})$/;
const SLACK_TS_RE = /^[0-9]{10}\.[0-9]{6}$/;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new TypeError(message);
}

export function githubCommitPush(input: { target: string; sha: string; branch: string }): ClaimAction {
  assert(REPO_RE.test(input.target), "githubCommitPush: target must be 'owner/repo'");
  assert(SHA_RE.test(input.sha), "githubCommitPush: sha must be 40 lowercase hex characters");
  assert(input.branch && input.branch.length > 0, "githubCommitPush: branch is required");
  return { action: "github.commit.push", target: input.target, params: { sha: input.sha, branch: input.branch } };
}

export function githubPrOpen(input: { target: string; number: number; base?: string; headSha?: string }): ClaimAction {
  assert(REPO_RE.test(input.target), "githubPrOpen: target must be 'owner/repo'");
  assert(Number.isInteger(input.number) && input.number >= 1, "githubPrOpen: number must be a positive integer");
  if (input.headSha !== undefined) {
    assert(SHA_RE.test(input.headSha), "githubPrOpen: headSha must be 40 lowercase hex characters");
  }
  const params: Record<string, unknown> = { number: input.number };
  if (input.base !== undefined) params.base = input.base;
  if (input.headSha !== undefined) params.head_sha = input.headSha;
  return { action: "github.pr.open", target: input.target, params };
}

export function githubChecksPass(input: { target: string; sha: string }): ClaimAction {
  assert(REPO_RE.test(input.target), "githubChecksPass: target must be 'owner/repo'");
  assert(SHA_RE.test(input.sha), "githubChecksPass: sha must be 40 lowercase hex characters");
  return { action: "github.checks.pass", target: input.target, params: { sha: input.sha } };
}

export function xPostPublish(input: { target: string; postId: string; textSha256?: string }): ClaimAction {
  assert(HANDLE_RE.test(input.target), "xPostPublish: target must be an @handle");
  assert(POST_ID_RE.test(input.postId), "xPostPublish: postId must be digits");
  if (input.textSha256 !== undefined) {
    assert(HEX64_RE.test(input.textSha256), "xPostPublish: textSha256 must be 64 lowercase hex characters");
  }
  const params: Record<string, unknown> = { post_id: input.postId };
  if (input.textSha256 !== undefined) params.text_sha256 = input.textSha256;
  return { action: "x.post.publish", target: input.target, params };
}

export function slackMessagePost(input: { target: string; ts: string; textSha256?: string }): ClaimAction {
  assert(SLACK_TARGET_RE.test(input.target), "slackMessagePost: target must be slack://<team_id>/<channel_id>");
  assert(SLACK_TS_RE.test(input.ts), "slackMessagePost: ts must match ^[0-9]{10}\\.[0-9]{6}$");
  if (input.textSha256 !== undefined) {
    assert(HEX64_RE.test(input.textSha256), "slackMessagePost: textSha256 must be 64 lowercase hex characters");
  }
  const params: Record<string, unknown> = { ts: input.ts };
  if (input.textSha256 !== undefined) params.text_sha256 = input.textSha256;
  return { action: "slack.message.post", target: input.target, params };
}

export function httpUrlStatus(input: { target: string; status?: number; contentFingerprint?: string }): ClaimAction {
  let url: URL;
  try {
    url = new URL(input.target);
  } catch {
    throw new TypeError("httpUrlStatus: target must be a valid URL");
  }
  assert(url.protocol === "https:", "httpUrlStatus: target must be an https:// URL");
  const params: Record<string, unknown> = {};
  if (input.status !== undefined) {
    assert(Number.isInteger(input.status), "httpUrlStatus: status must be an integer");
    params.status = input.status;
  }
  if (input.contentFingerprint !== undefined) params.content_fingerprint = input.contentFingerprint;
  return { action: "http.url.status", target: input.target, params };
}
