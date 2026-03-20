#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const pkgRoot = join(here, "..");
const cliPath = join(pkgRoot, "src", "cli.ts");
const require = createRequire(import.meta.url);
const tsxEsm = require.resolve("tsx/esm");

const result = spawnSync(
  process.execPath,
  ["--import", tsxEsm, cliPath, ...process.argv.slice(2)],
  { stdio: "inherit", cwd: process.cwd() },
);

process.exit(result.status ?? 1);
