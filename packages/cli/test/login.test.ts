import { mkdtempSync, readFileSync, statSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { login, logout } from "../src/commands.js";
import { configPath } from "../src/config.js";
import type { Io } from "../src/io.js";

function captureIo(): { io: Io; lines: string[]; errors: string[] } {
  const lines: string[] = [];
  const errors: string[] = [];
  return { io: { log: (l) => lines.push(l), error: (l) => errors.push(l) }, lines, errors };
}

let dir: string;
const REAL_KEY = "qed_sk_live_super_secret_value_12345";

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "qed-cli-test-"));
  process.env.QED_PROOF_CONFIG_DIR = dir;
});
afterEach(() => {
  delete process.env.QED_PROOF_CONFIG_DIR;
  rmSync(dir, { recursive: true, force: true });
});

describe("qed login / logout", () => {
  it("writes a 0600 config file and never echoes the key to stdout", async () => {
    const { io, lines, errors } = captureIo();
    const code = await login({ keyStdin: true }, io, {
      promptHidden: async () => "unused",
      readStdinAll: async () => REAL_KEY,
    });

    expect(code).toBe(0);
    const path = configPath();
    const stat = statSync(path);
    expect(stat.mode & 0o777).toBe(0o600);

    const saved = JSON.parse(readFileSync(path, "utf-8"));
    expect(saved.apiKey).toBe(REAL_KEY);

    const allOutput = [...lines, ...errors].join("\n");
    expect(allOutput).not.toContain(REAL_KEY);
    expect(allOutput).toContain("2345"); // last 4 chars are fine to show, masked
  });

  it("logout removes the config file", async () => {
    const { io } = captureIo();
    await login({ keyStdin: true }, io, { promptHidden: async () => "unused", readStdinAll: async () => REAL_KEY });
    expect(statSync(configPath())).toBeTruthy();

    const code = await logout(io);
    expect(code).toBe(0);
    expect(() => statSync(configPath())).toThrow();
  });
});
