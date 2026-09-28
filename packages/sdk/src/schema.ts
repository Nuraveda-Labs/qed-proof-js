/**
 * Structural validation against the vendored receipt schema (Draft 2020-12), matching
 * `oss/spec/tools/check.py`'s use of `jsonschema.Draft202012Validator`.
 *
 * The validator is precompiled at build time (scripts/build-validator.mjs, ajv "standalone"), so nothing is compiled
 * at runtime: no `new Function`, and so it works under a strict Content-Security-Policy without 'unsafe-eval'.
 */
import { validate } from "./generated/receipt-validator.js";

export function schemaValid(receipt: unknown): boolean {
  return Boolean(validate(receipt));
}
