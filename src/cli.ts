import { assertWorkflowPreflight } from "./preflight.js";
import { workflowRootFromCwd, loadWorkflowContract } from "./workflow-contract.js";

const DEFAULT_MAX_ITERATIONS = 50;

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

function main(): void {
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

  // Tracer bullet: preflight done; agent loop and prompt assembly follow in later tasks.
  void maxIterations;
  process.exit(0);
}

main();
