import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: { index: "src/index.ts" },
    format: ["esm", "cjs"],
    dts: true,
    sourcemap: true,
    clean: true,
    target: "node18",
    platform: "node",
  },
  {
    entry: { cli: "src/bin.ts" },
    format: ["cjs"],
    dts: false,
    sourcemap: true,
    clean: false,
    target: "node18",
    platform: "node",
    banner: { js: "#!/usr/bin/env node" },
  },
]);
