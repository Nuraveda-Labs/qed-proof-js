/**
 * Structural validation against the vendored schemas (Draft 2020-12), matching
 * `oss/spec/tools/check.py`'s use of `jsonschema.Draft202012Validator`: receipt, change entry and pipeline document.
 *
 * The validators are precompiled at build time (scripts/build-validator.mjs, ajv "standalone"), so nothing is compiled
 * at runtime: no `new Function`, and so it works under a strict Content-Security-Policy without 'unsafe-eval'.
 */
import { validate } from "./generated/receipt-validator.js";
import { validate as validateChange } from "./generated/change-validator.js";
import { validate as validatePipeline } from "./generated/pipeline-validator.js";

export function schemaValid(receipt: unknown): boolean {
  return Boolean(validate(receipt));
}

export function changeSchemaValid(entry: unknown): boolean {
  return Boolean(validateChange(entry));
}

export function pipelineSchemaValid(pipeline: unknown): boolean {
  return Boolean(validatePipeline(pipeline));
}
