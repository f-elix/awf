import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import assert from "node:assert/strict";
import { buildAgentPrompt } from "./prompt-assembly.js";
import { loadWorkflowContract } from "./workflow-contract.js";

const bundledHead = readFileSync(new URL("./prompt.md", import.meta.url), "utf8").slice(0, 80);

test("buildAgentPrompt: bundled + full tasks.json; no PRD block when prd.md absent", () => {
  const contract = loadWorkflowContract();
  const root = mkdtempSync(join(tmpdir(), "awf-prompt-"));
  try {
    const wf = join(root, contract.workflowDirectory.name);
    mkdirSync(wf, { recursive: true });
    const tasksPayload = '[{"x":1}]';
    writeFileSync(join(wf, "tasks.json"), tasksPayload, "utf8");

    const prompt = buildAgentPrompt(wf, contract);

    assert.ok(prompt.includes(bundledHead), "expected bundled prompt.md content");
    assert.ok(prompt.includes(tasksPayload), "expected full tasks.json text");
    assert.ok(!prompt.includes("UNIQUE_PRD_SENTINEL_XYZZY"));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("buildAgentPrompt: adds PRD path only when prd.md present; does not inline body", () => {
  const contract = loadWorkflowContract();
  const root = mkdtempSync(join(tmpdir(), "awf-prompt-"));
  try {
    const wf = join(root, contract.workflowDirectory.name);
    mkdirSync(wf, { recursive: true });
    writeFileSync(join(wf, "tasks.json"), "[]", "utf8");
    const prdBody = "UNIQUE_PRD_SENTINEL_XYZZY\nsecond line";
    writeFileSync(join(wf, "prd.md"), prdBody, "utf8");

    const prompt = buildAgentPrompt(wf, contract);

    assert.ok(prompt.includes("# PRD (path only)"));
    assert.ok(
      prompt.includes(contract.workflowDirectory.name) && prompt.includes("prd.md"),
      "expected relative path to prd in prompt",
    );
    assert.ok(!prompt.includes("UNIQUE_PRD_SENTINEL_XYZZY"), "PRD body must not be inlined");
    assert.ok(!prompt.includes("second line"), "PRD body must not be inlined");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
