/**
 * Structural validation against the vendored receipt schema (Draft 2020-12), matching
 * `oss/spec/tools/check.py`'s use of `jsonschema.Draft202012Validator`.
 */
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { receiptSchema } from "./generated/receipt-schema.js";

const ajv = new Ajv2020({ allErrors: false, strict: false });
addFormats(ajv);
const validate = ajv.compile(receiptSchema);

export function schemaValid(receipt: unknown): boolean {
  return Boolean(validate(receipt));
}
