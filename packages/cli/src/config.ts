import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync, chmodSync } from "node:fs";
import { homedir, platform } from "node:os";
import { join } from "node:path";

export interface CliConfig {
  apiKey?: string;
  baseUrl?: string;
}

export function configDir(): string {
  // Test/override hook: never used by the real config-dir resolution otherwise.
  if (process.env.QED_PROOF_CONFIG_DIR) return process.env.QED_PROOF_CONFIG_DIR;
  const p = platform();
  if (p === "darwin") {
    return join(homedir(), "Library", "Application Support", "qed-proof");
  }
  if (p === "win32") {
    const appData = process.env.APPDATA ?? join(homedir(), "AppData", "Roaming");
    return join(appData, "qed-proof");
  }
  const xdg = process.env.XDG_CONFIG_HOME;
  return join(xdg && xdg.length > 0 ? xdg : join(homedir(), ".config"), "qed-proof");
}

export function configPath(): string {
  return join(configDir(), "config.json");
}

export function readConfig(): CliConfig {
  const path = configPath();
  if (!existsSync(path)) return {};
  try {
    const text = readFileSync(path, "utf-8");
    return JSON.parse(text) as CliConfig;
  } catch {
    return {};
  }
}

export function writeConfig(config: CliConfig): void {
  const dir = configDir();
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const path = configPath();
  writeFileSync(path, JSON.stringify(config, null, 2) + "\n", { mode: 0o600 });
  chmodSync(path, 0o600);
}

export function clearConfig(): void {
  const path = configPath();
  if (existsSync(path)) unlinkSync(path);
}

export function resolveApiKey(config: CliConfig): string | undefined {
  return process.env.QED_PROOF_API_KEY ?? config.apiKey;
}

export function resolveBaseUrl(config: CliConfig): string | undefined {
  return process.env.QED_PROOF_BASE_URL ?? config.baseUrl;
}

/** Never the real key: only the last 4 characters, everything else masked. */
export function maskKey(key: string): string {
  if (key.length <= 4) return "*".repeat(key.length);
  return "*".repeat(key.length - 4) + key.slice(-4);
}
