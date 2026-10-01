/**
 * The precompiled (standalone) receipt validator must (1) agree exactly with a validator compiled at runtime from the
 * same schema, and (2) work where a strict Content-Security-Policy forbids evaluating strings as code. 0.1.1 compiled
 * with ajv at import time, so importing the SDK in such a page threw ("EvalError: … 'unsafe-eval' is not an allowed
 * source of script"), found live on the public receipt page.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import { afterEach, describe, expect, it, vi } from "vitest";
import { validate as standalone } from "../src/generated/receipt-validator.js";
import { validate as standaloneChange } from "../src/generated/change-validator.js";
import { validate as standalonePipeline } from "../src/generated/pipeline-validator.js";

const here = dirname(fileURLToPath(import.meta.url));
const vectorsDir = join(here, "..", "..", "..", "test", "vectors");
const manifest = JSON.parse(readFileSync(join(vectorsDir, "manifest.json"), "utf-8")) as {
  keyset: string;
  vectors: Array<{ file: string }>;
};
const schema = JSON.parse(readFileSync(join(here, "..", "..", "..", "src", "receipt.schema.json"), "utf-8"));
const runtime = new Ajv2020({ allErrors: false, strict: false }).compile(schema);

function mutations(r: Record<string, unknown>): unknown[] {
  const body = (r.body ?? {}) as Record<string, unknown>;
  return [
    r,
    { ...r, body: undefined },
    { ...r, body: { ...body, receipt_id: 42 } },
    { ...r, body: { ...body, extra_field: "x" } },
    { ...r, body: { ...body, verdict: { value: "maybe" } } },
    { ...r, body: { ...body, spec_version: "" } },
    { ...r, signature: "not-an-object" },
    { ...r, body: { ...body, agent: { id: "😀".repeat(300) } } }, // code-point lengths (the inlined ucs2length)
    null,
    [],
    "a string",
  ];
}

describe("standalone receipt validator", () => {
  it("agrees with a runtime-compiled validator on every vector and its mutations", () => {
    let compared = 0;
    for (const v of manifest.vectors) {
      const receipt = JSON.parse(readFileSync(join(vectorsDir, v.file), "utf-8"));
      for (const m of mutations(receipt)) {
        expect(Boolean(standalone(m)), `${v.file} mutation ${compared}`).toBe(Boolean(runtime(m)));
        compared++;
      }
    }
    expect(compared).toBeGreaterThanOrEqual(manifest.vectors.length * 11);
  });

  it("the generated module evaluates no code and requires no runtime module", () => {
    const src = readFileSync(join(here, "..", "src", "generated", "receipt-validator.js"), "utf-8");
    expect(src).not.toMatch(/new Function|\bFunction\(|\beval\(/);
    expect(src).not.toMatch(/\brequire\(/);
  });
});

describe("under a CSP without 'unsafe-eval'", () => {
  const RealFunction = globalThis.Function;
  afterEach(() => {
    globalThis.Function = RealFunction;
    vi.resetModules();
  });

  it("the SDK imports and verifies a receipt with the Function constructor disabled", async () => {
    // What a browser does under that CSP: evaluating a string as code throws.
    const blocked = function () {
      throw new EvalError("Evaluating a string as JavaScript violates the Content Security Policy");
    } as unknown as FunctionConstructor;
    blocked.prototype = RealFunction.prototype;
    globalThis.Function = blocked;
    vi.resetModules();
    const { verifyReceipt } = await import("../src/verify.js");
    const keys = JSON.parse(readFileSync(join(vectorsDir, manifest.keyset), "utf-8"));
    const text = readFileSync(join(vectorsDir, "001-valid-verified.json"), "utf-8");
    const report = await verifyReceipt(text, { keys });
    expect(report.checks.schema).toBe(true);
    expect(report.valid).toBe(true);
  });
});

describe("standalone change and pipeline validators", () => {
  const compileRuntime = (name: string) =>
    new Ajv2020({ allErrors: false, strict: false }).compile(
      JSON.parse(readFileSync(join(here, "..", "..", "..", "src", `${name}.schema.json`), "utf-8")),
    );
  const runtimeChange = compileRuntime("change");
  const runtimePipeline = compileRuntime("pipeline");
  const read = (f: string) => JSON.parse(readFileSync(join(vectorsDir, f), "utf-8"));

  it("agree with runtime-compiled validators on every vector, the example pipeline and their mutations", () => {
    const pipeline = read("pipeline.example.json");
    const pipelineMutations = [
      pipeline,
      { ...pipeline, id: "X" },
      { ...pipeline, extra: 1 },
      { ...pipeline, version: "1" },
      { ...pipeline, outcomes: { ...pipeline.outcomes, alerts: [pipeline.outcomes.alerts[0], pipeline.outcomes.alerts[0]] } },
      null,
      [],
      "a string",
    ];
    for (const m of pipelineMutations) expect(Boolean(standalonePipeline(m))).toBe(Boolean(runtimePipeline(m)));
    expect(standalonePipeline(pipeline)).toBe(true);
    for (const v of manifest.vectors) {
      for (const m of mutations(read(v.file))) {
        expect(Boolean(standaloneChange(m)), v.file).toBe(Boolean(runtimeChange(m)));
      }
    }
    expect(standaloneChange(read("027-valid-change.json"))).toBe(true);
  });

  it("the generated modules evaluate no code and require no runtime module", () => {
    for (const n of ["change", "pipeline"]) {
      const src = readFileSync(join(here, "..", "src", "generated", `${n}-validator.js`), "utf-8");
      expect(src).not.toMatch(/new Function|\bFunction\(|\beval\(/);
      expect(src).not.toMatch(/\brequire\(/);
    }
  });
});
