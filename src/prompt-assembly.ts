import { existsSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import type { WorkflowContract } from "./workflow-contract.js";
import { tasksJsonRelativePath } from "./preflight.js";

const bundledPromptPath = join(dirname(fileURLToPath(import.meta.url)), "prompt.md");

function prdRelativePath(contract: WorkflowContract): string | null {
  const entry = contract.workflowDirectory.entries.find((e) => e.relativePath === "prd.md");
  return entry ? entry.relativePath : null;
}

function readBundledPrompt(): string {
  return readFileSync(bundledPromptPath, "utf8");
}

/**
 * Builds the full agent prompt: bundled instructions + full tasks.json text; if `prd.md` exists, a short
 * block with its path relative to the project root (parent of the workflow directory) so the agent can
 * open it on demand without loading the full document into the prompt.
 * Callers should re-read tasks (and re-run this) each loop iteration so disk edits are visible.
 */
export function buildAgentPrompt(workflowRoot: string, contract: WorkflowContract): string {
  const tasksRel = tasksJsonRelativePath(contract);
  const tasksPath = join(workflowRoot, tasksRel);
  const tasksText = readFileSync(tasksPath, "utf8");

  const bundled = readBundledPrompt().trimEnd();
  const blocks: string[] = [bundled, "# tasks.json (full file)\n\n" + tasksText];

  const prdRel = prdRelativePath(contract);
  if (prdRel) {
    const prdPath = join(workflowRoot, prdRel);
    if (existsSync(prdPath)) {
      const projectRoot = dirname(workflowRoot);
      const prdPathFromProject = relative(projectRoot, prdPath);
      blocks.push(
        "# PRD (path only)\n\n" +
          `The PRD exists at \`${prdPathFromProject}\` (path relative to the project root). Open it when you need product scope.\n`,
      );
    }
  }

  return blocks.join("\n\n---\n\n");
}
