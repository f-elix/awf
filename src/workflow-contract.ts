import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export type WorkflowContract = {
  version: string;
  workflowDirectory: {
    name: string;
    resolution: string;
    entries: Array<{ relativePath: string; required: boolean; description: string }>;
  };
};

const contractPath = join(dirname(fileURLToPath(import.meta.url)), "..", "spec", "workflow.json");

export function loadWorkflowContract(): WorkflowContract {
  const raw = readFileSync(contractPath, "utf8");
  return JSON.parse(raw) as WorkflowContract;
}

export function workflowRootFromCwd(cwd: string, contract: WorkflowContract): string {
  return join(cwd, contract.workflowDirectory.name);
}
