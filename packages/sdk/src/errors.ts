export class QedProofError extends Error {
  status: number;
  detail: string;

  constructor(status: number, detail: string) {
    super(`QedProof API error ${status}: ${detail}`);
    this.name = "QedProofError";
    this.status = status;
    this.detail = detail;
  }
}

export class RateLimitError extends QedProofError {
  retryAfter: number | undefined;

  constructor(detail: string, retryAfter: number | undefined) {
    super(429, detail);
    this.name = "RateLimitError";
    this.retryAfter = retryAfter;
  }
}
