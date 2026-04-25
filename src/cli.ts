import { spawn } from "node:child_process";
import { readdir, rm, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { createInterface } from "node:readline";
import { join, resolve } from "node:path";

import { buildAgentPrompt } from "./prompt-assembly.js";
import { assertWorkflowPreflight } from "./preflight.js";
import { awfPackageRootFromThisModule } from "./skills-discovery.js";
import { formatSkillsInstallPreflightMessage, installBundledSkills } from "./skills-install.js";
import {
  loadWorkflowContract,
  workflowRootFromCwd,
  type WorkflowContract,
} from "./workflow-contract.js";

const DEFAULT_MAX_ITERATIONS = 50;

const COMPLETION_SIGIL = "<promise>COMPLETE</promise>";

const AGENT_COMMAND = "agent";
const AGENT_MODEL_DEFAULT = "auto";
/** Prompt is always the last argument; streaming matches Cursor headless docs. */
const AGENT_FIXED_ARGS = [
  "--print",
  "--trust",
  "--force",
  "--output-format",
  "stream-json",
] as const;

type StreamEvent = {
  type?: string;
  subtype?: string;
  message?: { content?: Array<{ text?: string }> };
};

const HELP = `awf — agentic workflow CLI

Usage:
  awf run [maxIterations] [--model <model>]
  awf reset
  awf skills install

  maxIterations  Optional positive integer (default: ${DEFAULT_MAX_ITERATIONS})
  model          Optional agent model (default: ${AGENT_MODEL_DEFAULT})

awf run: repeatedly invokes Cursor agent with --force so the agent may edit files
in your working tree; review changes before committing. Workflow layout is defined
only in the shipped spec/workflow.json (single contract).

awf reset: removes all files and subdirectories inside the workflow directory
(.awf by contract) under the current working directory; the directory itself
is kept. No-op if that path is already absent.

awf skills install: copies every skill from this package's skills/ tree into
~/.agents/skills/awf-<name>/ (see awf skills --help).
`;

const SKILLS_HELP = `awf skills — install bundled agent skills

Usage:
  awf skills install

Copies each immediate subdirectory of this package's skills/ folder to
~/.agents/skills/awf-<dirname>/, replacing any previous awf-<dirname> tree.
Creates ~/.agents and ~/.agents/skills if needed. Other folders under
~/.agents/skills are left unchanged.

On success, prints one line per skill: source path -> destination path (absolute).
Errors go to stderr; exit status is non-zero on failure.
`;

function printHelp(): void {
  process.stdout.write(HELP);
}

function printSkillsHelp(): void {
  process.stdout.write(SKILLS_HELP);
}

function isEnoent(e: unknown): boolean {
  return (
    typeof e === "object" &&
    e !== null &&
    "code" in e &&
    (e as NodeJS.ErrnoException).code === "ENOENT"
  );
}

async function runResetCli(): Promise<void> {
  const contract = loadWorkflowContract();
  const awfRoot = workflowRootFromCwd(process.cwd(), contract);
  let st;
  try {
    st = await stat(awfRoot);
  } catch (e) {
    if (isEnoent(e)) {
      process.stdout.write(`awf: workflow directory ${awfRoot} was already absent\n`);
      return;
    }
    throw e;
  }
  if (!st.isDirectory()) {
    throw new Error(`workflow path is not a directory: ${awfRoot}`);
  }
  for (const ent of await readdir(awfRoot, { withFileTypes: true })) {
    await rm(join(awfRoot, ent.name), { recursive: true, force: true });
  }
  process.stdout.write(`awf: emptied workflow directory ${awfRoot}\n`);
}

function runSkillsInstallCli(): void {
  const destRoot = join(homedir(), ".agents", "skills");
  const result = installBundledSkills({
    packageRoot: awfPackageRootFromThisModule(),
    destRoot,
  });

  if (!result.ok) {
    if (result.kind === "preflight") {
      process.stderr.write(`awf: ${formatSkillsInstallPreflightMessage(result.discovery)}\n`);
    } else {
      process.stderr.write(`awf: ${result.message}\n`);
    }
    process.exit(1);
  }

  for (const { sourcePath, destPath } of result.installed) {
    process.stdout.write(`${resolve(sourcePath)} -> ${resolve(destPath)}\n`);
  }
  process.exit(0);
}

function parseRunArgs(args: string[]): { maxIterations: number; model: string } {
  let maxIterations = DEFAULT_MAX_ITERATIONS;
  let model = AGENT_MODEL_DEFAULT;
  let sawMaxIterations = false;
  let sawModel = false;

  for (let i = 0; i < args.length; i++) {
    const raw = args[i];

    if (raw === "--model") {
      if (sawModel) {
        throw new Error("Duplicate --model flag");
      }
      const value = args[i + 1];
      if (value === undefined || value.startsWith("--")) {
        throw new Error("Missing model value for --model");
      }
      model = value;
      sawModel = true;
      i++;
      continue;
    }

    if (raw.startsWith("--")) {
      throw new Error(`Unknown flag: ${raw}`);
    }

    if (sawMaxIterations) {
      throw new Error(`Unexpected arguments after maxIterations: ${args.slice(i).join(" ")}`);
    }

    if (!/^\d+$/.test(raw)) {
      throw new Error(`maxIterations must be a non-negative integer, got: ${JSON.stringify(raw)}`);
    }
    const n = Number(raw);
    if (!Number.isSafeInteger(n) || n < 0) {
      throw new Error(`maxIterations must be a non-negative integer, got: ${JSON.stringify(raw)}`);
    }
    if (n === 0) {
      throw new Error("maxIterations must be at least 1");
    }
    maxIterations = n;
    sawMaxIterations = true;
  }

  return { maxIterations, model };
}

function assistantTextFromStreamEvent(o: StreamEvent): string {
  const content = o.message?.content;
  if (!Array.isArray(content) || content.length === 0) {
    return "";
  }
  const text = typeof content[0]?.text === "string" ? content[0]?.text : "";
  const normalizedText = text.trim().replace(/\n/g, " ");
  if (!normalizedText) {
    return "";
  }
  return text;
}

/**
 * Runs `agent` with stream-json; forwards only assistant text to stdout (no tool/system dumps).
 */
function buildAgentArgs(model: string): string[] {
  return ["--model", model, ...AGENT_FIXED_ARGS];
}

function runAgentStream(
  prompt: string,
  model: string,
): Promise<{
  accumulated: string;
  status: number | null;
  error: Error | undefined;
}> {
  return new Promise((resolve) => {
    const child = spawn(AGENT_COMMAND, [...buildAgentArgs(model), prompt], {
      stdio: ["ignore", "pipe", "inherit"],
      env: process.env,
    });

    let spawnError: Error | undefined;
    child.on("error", (e) => {
      spawnError = e instanceof Error ? e : new Error(String(e));
    });

    let assistantSoFar = "";
    const stdout = child.stdout;
    if (!stdout) {
      resolve({
        accumulated: assistantSoFar,
        status: null,
        error: spawnError ?? new Error("agent stdout missing"),
      });
      return;
    }

    const rl = createInterface({ input: stdout, crlfDelay: Infinity });
    rl.on("line", (line) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(line);
      } catch {
        return;
      }
      if (!parsed || typeof parsed !== "object") {
        return;
      }
      const ev = parsed as StreamEvent;
      if (ev.type !== "assistant") {
        return;
      }
      const chunk = assistantTextFromStreamEvent(ev);
      if (!chunk) {
        return;
      }
      assistantSoFar += chunk;
      process.stdout.write(chunk);
    });

    child.on("close", (code) => {
      rl.close();
      resolve({ accumulated: assistantSoFar, status: code, error: spawnError });
    });
  });
}

async function runRalphLoop(
  workflowRoot: string,
  contract: WorkflowContract,
  maxIterations: number,
  model: string,
): Promise<void> {
  for (let i = 1; i <= maxIterations; i++) {
    process.stdout.write(`=== Running iteration ${i} ===\n`);

    const prompt = buildAgentPrompt(workflowRoot, contract);
    const { accumulated, status, error } = await runAgentStream(prompt, model);

    if (!accumulated.endsWith("\n")) {
      process.stdout.write("\n");
    }

    if (error) {
      process.stderr.write(`awf: failed to run \`${AGENT_COMMAND}\`: ${error.message}\n`);
      process.exit(1);
    }
    if (status !== 0) {
      process.stderr.write(`awf: ${AGENT_COMMAND} exited with status ${status ?? "unknown"}\n`);
      process.exit(status ?? 1);
    }

    if (accumulated.includes(COMPLETION_SIGIL)) {
      process.stdout.write(`\n=== All tasks complete after ${i} iterations. ===\n`);
      process.exit(0);
    }
  }

  process.stdout.write(
    `awf: max iterations (${maxIterations}) reached without completion sigil; work may be incomplete.\n`,
  );
  process.exit(0);
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);

  if (argv.length === 0) {
    printHelp();
    process.exit(1);
  }

  const [cmd, ...rest] = argv;

  if (cmd === "-h" || cmd === "--help") {
    printHelp();
    process.exit(0);
  }

  if (cmd === "skills") {
    const [sub, ...skillRest] = rest;
    if (sub === undefined || sub === "-h" || sub === "--help") {
      printSkillsHelp();
      process.exit(0);
    }
    if (sub !== "install") {
      process.stderr.write(`Unknown skills subcommand: ${sub}\n\n`);
      printSkillsHelp();
      process.exit(1);
    }
    if (skillRest.length > 0) {
      process.stderr.write(`awf: unexpected arguments after install: ${skillRest.join(" ")}\n`);
      process.exit(1);
    }
    runSkillsInstallCli();
    return;
  }

  if (cmd === "reset") {
    if (rest.length > 0) {
      process.stderr.write(`awf: unexpected arguments after reset: ${rest.join(" ")}\n`);
      process.exit(1);
    }
    await runResetCli();
    process.exit(0);
  }

  if (cmd !== "run") {
    process.stderr.write(`Unknown command: ${cmd}\n\n`);
    printHelp();
    process.exit(1);
  }

  let maxIterations: number;
  let model: string;
  try {
    ({ maxIterations, model } = parseRunArgs(rest));
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    process.stderr.write(`awf: ${msg}\n`);
    process.exit(1);
  }

  const contract = loadWorkflowContract();
  const workflowRoot = workflowRootFromCwd(process.cwd(), contract);
  assertWorkflowPreflight(workflowRoot, contract);

  await runRalphLoop(workflowRoot, contract, maxIterations, model);
}

main().catch((e) => {
  const msg = e instanceof Error ? e.message : String(e);
  process.stderr.write(`awf: ${msg}\n`);
  process.exit(1);
});
