// Packs each workspace and checks the manifest npm would actually publish. npm silently rewrites package.json
// on publish ("errors corrected") — npm 11 dropped the cli's "./dist/cli.cjs" bin, which would have shipped
// a CLI with no `qed` command. The source manifest looking right proves nothing; the packed one is the truth.
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const workspaces = ["packages/sdk", "packages/cli"];
let failed = false;
const fail = (msg) => {
  console.error(`check-pack: ${msg}`);
  failed = true;
};

for (const ws of workspaces) {
  const source = JSON.parse(readFileSync(join(ws, "package.json"), "utf8"));
  const out = mkdtempSync(join(tmpdir(), "qed-pack-"));
  try {
    const log = execFileSync("npm", ["pack", "--pack-destination", out, "--json"], {
      cwd: ws,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    const [{ filename, files }] = JSON.parse(log);
    execFileSync("tar", ["-xzf", join(out, filename), "-C", out]);
    const packed = JSON.parse(readFileSync(join(out, "package", "package.json"), "utf8"));
    const shipped = new Set(files.map((f) => f.path));

    for (const [name, target] of Object.entries(source.bin ?? {})) {
      const got = packed.bin?.[name];
      if (!got) fail(`${packed.name}: bin "${name}" was dropped from the packed manifest`);
      else if (!shipped.has(got.replace(/^\.\//, ""))) fail(`${packed.name}: bin "${name}" -> ${got} is not in the tarball`);
      else if (got !== target) fail(`${packed.name}: bin "${name}" rewritten from ${target} to ${got}`);
    }
    if (packed.repository?.directory !== ws) {
      fail(`${packed.name}: repository.directory is ${packed.repository?.directory}, expected ${ws}`);
    }
    // `npm pack` keeps the manifest as written; only publish normalises it, so ask publish too.
    const dry = spawnSync("npm", ["publish", "--dry-run", "--access", "public"], { cwd: ws, encoding: "utf8" });
    if (dry.status !== 0) fail(`${packed.name}: npm publish --dry-run exited ${dry.status}\n${dry.stderr}`);
    const corrected = dry.stderr.match(/errors corrected:[\s\S]*?(?=\nnpm notice|$)/);
    if (corrected) fail(`${packed.name}: npm would rewrite package.json on publish:\n${corrected[0]}`);
    if (!failed) console.log(`check-pack: ${packed.name}@${packed.version} ok (${files.length} files)`);
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
}
// The SDK must run under a strict CSP (no 'unsafe-eval'): its built output may never evaluate strings as code. 0.1.1
// compiled its schema with ajv at import time, which broke the public receipt page (2026-09-28).
for (const f of ["packages/sdk/dist/index.js", "packages/sdk/dist/index.cjs"]) {
  const src = readFileSync(f, "utf8");
  if (/new Function|\bFunction\(|\beval\(/.test(src)) fail(`${f} evaluates code at runtime (breaks under a strict CSP)`);
}
// The cli pins the exact sdk it was built and tested against; a version bump that misses the pin ships a mismatch.
const sdkVersion = JSON.parse(readFileSync("packages/sdk/package.json", "utf8")).version;
const cliPin = JSON.parse(readFileSync("packages/cli/package.json", "utf8")).dependencies?.["@qed-proof/sdk"];
if (cliPin !== sdkVersion) fail(`@qed-proof/cli pins @qed-proof/sdk ${cliPin}, but the sdk is ${sdkVersion}`);
process.exit(failed ? 1 : 0);
