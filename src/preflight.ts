import { Ajv } from "ajv";
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { WorkflowContract } from "./workflow-contract.js";

const tasksSchemaPath = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "spec",
  "tasks.schema.json",
);

function die(message: string): never {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

/** Resolved from the workflow contract (required entries); used by preflight and prompt assembly. */
export function tasksJsonRelativePath(contract: WorkflowContract): string {
  const required = contract.workflowDirectory.entries.filter((e) => e.required);
  if (required.length === 0) {
    throw new Error("Workflow contract defines no required workflow directory entries");
  }
  if (required.length === 1) {
    return required[0].relativePath;
  }
  const tasks = required.find((e) => /(^|\/)tasks\.json$/i.test(e.relativePath));
  if (!tasks) {
    throw new Error(
      "Workflow contract has multiple required entries; cannot resolve tasks.json path",
    );
  }
  return tasks.relativePath;
}

/**
 * Fail-fast checks: workflow dir exists, tasks.json is valid JSON array, items match spec/tasks.schema.json.
 */
export function assertWorkflowPreflight(workflowRoot: string, contract: WorkflowContract): void {
  if (!existsSync(workflowRoot)) {
    die(
      `awf: workflow directory missing: ${workflowRoot}\n` +
        `  Create it per spec/workflow.json (resolution: ${contract.workflowDirectory.resolution}).`,
    );
  }
  if (!statSync(workflowRoot).isDirectory()) {
    die(`awf: workflow path exists but is not a directory: ${workflowRoot}`);
  }

  const tasksRel = tasksJsonRelativePath(contract);
  const tasksPath = join(workflowRoot, tasksRel);

  if (!existsSync(tasksPath)) {
    die(
      `awf: missing ${tasksRel} under ${contract.workflowDirectory.name}/\n` +
        `  Generate it with the **prd-to-tasks** Cursor skill (or equivalent) so the backlog matches spec/tasks.schema.json.`,
    );
  }

  const text = readFileSync(tasksPath, "utf8");
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    die(`awf: invalid JSON in ${tasksPath}: ${msg}`);
  }

  if (!Array.isArray(parsed)) {
    die(
      `awf: ${tasksRel} must be a JSON array at the top level (got ${typeof parsed}).\n` +
        `  See spec/tasks.schema.json and the task object fields in the workflow contract.`,
    );
  }

  const schemaRaw = readFileSync(tasksSchemaPath, "utf8");
  const schema = JSON.parse(schemaRaw) as object;
  const ajv = new Ajv({ allErrors: true, strict: false });
  const validate = ajv.compile(schema);
  if (!validate(parsed)) {
    const detail = validate.errors?.length
      ? `\n  ${ajv.errorsText(validate.errors, { separator: "\n  " })}`
      : "";
    die(
      `awf: ${tasksRel} failed schema validation (spec/tasks.schema.json).\n` +
        `  Each task must include: title, what_to_build, acceptance_criteria, blocked_by, user_stories_addressed, comments, commit_messages, done.${detail}`,
    );
  }
}
