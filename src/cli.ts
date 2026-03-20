import { spawn } from "node:child_process";
import { createInterface } from "node:readline";

import { buildAgentPrompt } from "./prompt-assembly.js";
import { assertWorkflowPreflight } from "./preflight.js";
import {
  loadWorkflowContract,
  workflowRootFromCwd,
  type WorkflowContract,
} from "./workflow-contract.js";

const DEFAULT_MAX_ITERATIONS = 50;

const COMPLETION_SIGIL = "<promise>COMPLETE</promise>";

const AGENT_COMMAND = "agent";
/** Prompt is always the last argument; streaming matches Cursor headless docs. */
const AGENT_BASE_ARGS = [
  "--model",
  "composer-2",
  "--print",
  "--trust",
  "--force",
  "--output-format",
  "stream-json",
  "--stream-partial-output",
] as const;

type StreamEvent = {
  type?: string;
  subtype?: string;
  message?: { content?: Array<{ text?: string }> };
};

const HELP = `awf — agentic workflow CLI

Usage:
  awf run [maxIterations]

  maxIterations  Optional positive integer (default: ${DEFAULT_MAX_ITERATIONS})

The loop invokes Cursor agent with --force so the agent may edit files in your
working tree; review changes before committing.

Workflow layout is defined only in the shipped spec/workflow.json (single contract).
`;

function printHelp(): void {
  process.stdout.write(HELP);
}

function parseRunArgs(args: string[]): { maxIterations: number } {
  if (args.length === 0) {
    return { maxIterations: DEFAULT_MAX_ITERATIONS };
  }
  if (args.length > 1) {
    throw new Error(`Unexpected arguments after maxIterations: ${args.slice(1).join(" ")}`);
  }
  const raw = args[0];
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
  return { maxIterations: n };
}

function assistantTextFromStreamEvent(o: StreamEvent): string {
  const content = o.message?.content;
  if (!Array.isArray(content) || content.length === 0) {
    return "";
  }
  const text = content[0]?.text;
  return typeof text === "string" ? text : "";
}

/**
 * Cursor's `--stream-partial-output` usually sends **growing full snapshots** of the assistant
 * message (each `text` extends the previous), not raw token deltas. Treat both that and plain
 * deltas by: emit only the suffix after the last snapshot, skip duplicate frames.
 */
function mergeAssistantStreamChunk(prior: string, text: string): { next: string; deltaToPrint: string } {
  if (!text || text === prior) {
    return { next: prior, deltaToPrint: "" };
  }
  if (text.startsWith(prior)) {
    return { next: text, deltaToPrint: text.slice(prior.length) };
  }
  return { next: prior + text, deltaToPrint: text };
}

/**
 * Runs `agent` with stream-json; forwards only assistant text to stdout (no tool/system dumps).
 */
function runAgentStream(prompt: string): Promise<{
  accumulated: string;
  status: number | null;
  error: Error | undefined;
}> {
  return new Promise((resolve) => {
    const child = spawn(AGENT_COMMAND, [...AGENT_BASE_ARGS, prompt], {
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
      const { next, deltaToPrint } = mergeAssistantStreamChunk(assistantSoFar, chunk);
      assistantSoFar = next;
      if (deltaToPrint) {
        process.stdout.write(deltaToPrint);
      }
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
): Promise<void> {
  for (let i = 1; i <= maxIterations; i++) {
    const prompt = buildAgentPrompt(workflowRoot, contract);
    const { accumulated, status, error } = await runAgentStream(prompt);

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
      process.stdout.write(`All tasks complete after ${i} iterations.\n`);
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

  if (cmd !== "run") {
    process.stderr.write(`Unknown command: ${cmd}\n\n`);
    printHelp();
    process.exit(1);
  }

  let maxIterations: number;
  try {
    maxIterations = parseRunArgs(rest).maxIterations;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    process.stderr.write(`awf: ${msg}\n`);
    process.exit(1);
  }

  const contract = loadWorkflowContract();
  const workflowRoot = workflowRootFromCwd(process.cwd(), contract);
  assertWorkflowPreflight(workflowRoot, contract);

  await runRalphLoop(workflowRoot, contract, maxIterations);
}

main().catch((e) => {
  const msg = e instanceof Error ? e.message : String(e);
  process.stderr.write(`awf: ${msg}\n`);
  process.exit(1);
});
