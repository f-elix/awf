---
name: write-qa-plan
description: Read .awf/tasks.json (and optional .awf/prd.md), infer intended behavior of the new implementation, and write .awf/qa.md as a step-by-step manual test plan in product/flow order—not task order. Use when the user wants a QA plan, test plan, manual test checklist, or pre-release verification.
---

Normative workflow layout and `tasks.json` rules live in **[`spec/workflow.json`](https://github.com/f-elix/awf/blob/main/spec/workflow.json)** in [**f-elix/awf**](https://github.com/f-elix/awf) (with schema via that file’s `$ref`). The workflow directory under the project cwd is **`.awf`**.

# Write QA Plan

## Inputs

1. **Required**: Read **`.awf/tasks.json`**.
2. **Recommended**: If **`.awf/prd.md`** exists and is not already in context, skim it for wording, actors, and constraints so the plan matches how the feature was specified.

If **`.awf/tasks.json`** is missing or empty, tell the user it must exist first (e.g. PRD → tasks workflow) and stop.

## Process

1. **Synthesize behavior.** From `title`, `what_to_build`, `acceptance_criteria`, and any PRD context, form a mental model of **what the new implementation should do**—end-to-end behaviors, user-visible outcomes, and integrations worth exercising. Treat tasks as **source material**, not as the outline of **`.awf/qa.md`**.

2. **Order by test flow, not by tasks.** Structure **`.awf/qa.md`** as one or a few **coherent journeys** (how a tester would walk the product: setup → primary path → branches → edge cases). The sequence should mirror **whatever is being tested** (screens, APIs, CLIs, jobs—whatever the work actually is). **Do not** mirror the array order of **`.awf/tasks.json`** or `blocked_by` unless that happens to match the real workflow.

3. **Write steps.** For each part of the flow: concrete actions, data or inputs, and **Pass if** / expected observable results. Fold related checks into the same numbered sequence when a single walk naturally proves them. Add negative or edge-case steps where risk warrants.

4. **Leave internal-only work out.** Refactors, dependency-only slices, or other items that are **not meaningfully verifiable** in a manual plan—**omit them entirely.** Do not add “N/A” sections, task inventory, or explanations for what you skipped.

5. **Cross-cutting checks** (regression smoke, a11y spot-check, migration sanity, etc.): include **once**, only when the synthesized behavior implies they matter.

6. Save to **`.awf/qa.md`**. Do not modify **`.awf/tasks.json`**.

7. If the build is not ready yet, use future tense (“After X is deployed, …”) but keep steps concrete so they can be run unchanged later.

## Output template

Shape **`.awf/qa.md`** like this; **section titles should describe flows or areas under test**, not task titles (unless a section happens to match one task closely).

<qa-template>

# QA Plan

Short intro: feature or release under test; informed by **`.awf/tasks.json`** (and **`.awf/prd.md`** if used).

## Preconditions

- Environment, accounts, flags, seed data, URLs, how to get the revision under test.

## <Flow or area name>

Numbered steps the tester follows in sequence for this path.

1. … **Pass if:** …
2. …

### <Sub-flow or branch> *(optional)*

1. …

(repeat sections for each natural testing journey)

## Regression / cleanup *(optional)*

- Brief follow-ups if shared surfaces were touched.

## Sign-off *(optional)*

- Tester, date, build/commit, notes.

</qa-template>

## Quality bar

- A reader understands **expected behavior** from the plan itself; task titles are not required for comprehension.
- Ordering follows **real usage**, not **`.awf/tasks.json`**.
- Steps are specific enough for another person to execute without reading the codebase.
