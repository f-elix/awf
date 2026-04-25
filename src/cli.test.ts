import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

const require = createRequire(import.meta.url);
const tsxImport = require.resolve("tsx");
const cliPath = fileURLToPath(new URL("./cli.ts", import.meta.url));
const completionSigil = "<promise>COMPLETE</promise>";

function makeWorkspace(): {
  cwd: string;
  binDir: string;
  agentArgsFile: string;
  cleanup: () => void;
} {
  const root = mkdtempSync(join(tmpdir(), "awf-cli-"));
  const binDir = join(root, "bin");
  mkdirSync(binDir, { recursive: true });
  const cwd = join(root, "workspace");
  mkdirSync(join(cwd, ".awf"), { recursive: true });
  writeFileSync(join(cwd, ".awf", "tasks.json"), "[]", "utf8");
  const agentArgsFile = join(root, "agent-argv.json");
  const cleanup = () => rmSync(root, { recursive: true, force: true });
  return { cwd, binDir, agentArgsFile, cleanup };
}

function makeFakeAgent(binDir: string): void {
  const agentPath = join(binDir, "agent");
  writeFileSync(
    agentPath,
    `#!/usr/bin/env node
const fs = require("node:fs");
fs.writeFileSync(process.env.AWF_AGENT_ARGS_FILE, JSON.stringify(process.argv.slice(2), null, 2));
process.stdout.write(
  JSON.stringify({
    type: "assistant",
    message: { content: [{ text: ${JSON.stringify(completionSigil)} }] },
  }) + "\\n",
);
`,
    "utf8",
  );
  chmodSync(agentPath, 0o755);
}

function runCli(args: string[], cwd: string, extraEnv: Record<string, string> = {}) {
  const pathEnv = extraEnv.PATH ?? process.env.PATH ?? "";
  const result = spawnSync(process.execPath, ["--import", tsxImport, cliPath, ...args], {
    cwd,
    env: {
      ...process.env,
      ...extraEnv,
      PATH: pathEnv,
    },
    encoding: "utf8",
  });
  if (result.error) {
    throw result.error;
  }
  return result;
}

function agentArgsFromFile(path: string): string[] {
  return JSON.parse(readFileSync(path, "utf8")) as string[];
}

test("awf run defaults model to auto", () => {
  const ws = makeWorkspace();
  try {
    makeFakeAgent(ws.binDir);

    const result = runCli(["run"], ws.cwd, {
      PATH: `${ws.binDir}${process.platform === "win32" ? ";" : ":"}${process.env.PATH ?? ""}`,
      AWF_AGENT_ARGS_FILE: ws.agentArgsFile,
    });

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /=== Running iteration 1 ===/);
    assert.match(result.stdout, /<promise>COMPLETE<\/promise>/);

    const args = agentArgsFromFile(ws.agentArgsFile);
    assert.deepEqual(args.slice(0, 7), [
      "--model",
      "auto",
      "--print",
      "--trust",
      "--force",
      "--output-format",
      "stream-json",
    ]);
  } finally {
    ws.cleanup();
  }
});

test("awf run accepts positional maxIterations without model", () => {
  const ws = makeWorkspace();
  try {
    makeFakeAgent(ws.binDir);

    const result = runCli(["run", "25"], ws.cwd, {
      PATH: `${ws.binDir}${process.platform === "win32" ? ";" : ":"}${process.env.PATH ?? ""}`,
      AWF_AGENT_ARGS_FILE: ws.agentArgsFile,
    });

    assert.equal(result.status, 0, result.stderr);
    const args = agentArgsFromFile(ws.agentArgsFile);
    assert.deepEqual(args.slice(0, 7), [
      "--model",
      "auto",
      "--print",
      "--trust",
      "--force",
      "--output-format",
      "stream-json",
    ]);
  } finally {
    ws.cleanup();
  }
});

test("awf run accepts explicit auto model", () => {
  const ws = makeWorkspace();
  try {
    makeFakeAgent(ws.binDir);

    const result = runCli(["run", "--model", "auto"], ws.cwd, {
      PATH: `${ws.binDir}${process.platform === "win32" ? ";" : ":"}${process.env.PATH ?? ""}`,
      AWF_AGENT_ARGS_FILE: ws.agentArgsFile,
    });

    assert.equal(result.status, 0, result.stderr);
    const args = agentArgsFromFile(ws.agentArgsFile);
    assert.deepEqual(args.slice(0, 7), [
      "--model",
      "auto",
      "--print",
      "--trust",
      "--force",
      "--output-format",
      "stream-json",
    ]);
  } finally {
    ws.cleanup();
  }
});

test("awf run accepts --model before maxIterations", () => {
  const ws = makeWorkspace();
  try {
    makeFakeAgent(ws.binDir);

    const result = runCli(["run", "--model", "gpt-5.5-high", "25"], ws.cwd, {
      PATH: `${ws.binDir}${process.platform === "win32" ? ";" : ":"}${process.env.PATH ?? ""}`,
      AWF_AGENT_ARGS_FILE: ws.agentArgsFile,
    });

    assert.equal(result.status, 0, result.stderr);
    const args = agentArgsFromFile(ws.agentArgsFile);
    assert.deepEqual(args.slice(0, 7), [
      "--model",
      "gpt-5.5-high",
      "--print",
      "--trust",
      "--force",
      "--output-format",
      "stream-json",
    ]);
  } finally {
    ws.cleanup();
  }
});

test("awf run accepts maxIterations before --model", () => {
  const ws = makeWorkspace();
  try {
    makeFakeAgent(ws.binDir);

    const result = runCli(["run", "25", "--model", "gpt-5.5-high"], ws.cwd, {
      PATH: `${ws.binDir}${process.platform === "win32" ? ";" : ":"}${process.env.PATH ?? ""}`,
      AWF_AGENT_ARGS_FILE: ws.agentArgsFile,
    });

    assert.equal(result.status, 0, result.stderr);
    const args = agentArgsFromFile(ws.agentArgsFile);
    assert.deepEqual(args.slice(0, 7), [
      "--model",
      "gpt-5.5-high",
      "--print",
      "--trust",
      "--force",
      "--output-format",
      "stream-json",
    ]);
  } finally {
    ws.cleanup();
  }
});

test("awf run rejects multiple positional values", () => {
  const ws = makeWorkspace();
  try {
    const result = runCli(["run", "10", "20"], ws.cwd);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /unexpected arguments after maxIterations/i);
  } finally {
    ws.cleanup();
  }
});

test("awf run rejects invalid positional maxIterations", () => {
  const ws = makeWorkspace();
  try {
    const result = runCli(["run", "foo"], ws.cwd);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /maxIterations must be a non-negative integer/i);
  } finally {
    ws.cleanup();
  }
});

test("awf run rejects duplicate --model flags", () => {
  const ws = makeWorkspace();
  try {
    const result = runCli(["run", "--model", "gpt-5.5-high", "--model", "auto"], ws.cwd);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /duplicate .*--model/i);
  } finally {
    ws.cleanup();
  }
});

test("awf help documents awf run model usage and default auto", () => {
  const ws = makeWorkspace();
  try {
    const result = runCli(["--help"], ws.cwd);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /awf run \[maxIterations\] \[--model <model>\]/);
    assert.match(result.stdout, /Optional agent model \(default: auto\)/);
  } finally {
    ws.cleanup();
  }
});

test("awf run rejects missing --model value", () => {
  const ws = makeWorkspace();
  try {
    const result = runCli(["run", "--model"], ws.cwd);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /missing .*model value/i);
  } finally {
    ws.cleanup();
  }
});

test("awf run rejects unknown flags", () => {
  const ws = makeWorkspace();
  try {
    const result = runCli(["run", "--bogus"], ws.cwd);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /unknown flag/i);
  } finally {
    ws.cleanup();
  }
});
