---
name: prd-to-tasks
description: Break a PRD into independently-grabbable tasks using tracer-bullet vertical slices. Use when user wants to convert a PRD to tasks, create implementation tickets, or break down a PRD into work items.
---

Normative workflow layout and the **exact** `tasks.json` object shape (required fields, types) are defined in **[`spec/workflow.json`](https://github.com/f-elix/awf/blob/main/spec/workflow.json)** and **[`spec/tasks.schema.json`](https://github.com/f-elix/awf/blob/main/spec/tasks.schema.json)** in [**f-elix/awf**](https://github.com/f-elix/awf). The workflow directory under the project cwd is **`.awf`**.

# PRD to Tasks

Break a PRD into independently-grabbable tasks using vertical slices (tracer bullets).

## Process

### 1. Locate the PRD

The PRD file should be located at **`.awf/prd.md`**.

If the PRD is not already in your context window, read the file.

### 2. Explore the codebase (optional)

If you have not already explored the codebase, do so to understand the current state of the code.

### 3. Draft vertical slices

Break the PRD into **tracer bullet** tasks. Each task is a thin vertical slice that cuts through ALL integration layers end-to-end, NOT a horizontal slice of one layer.

Slices may be 'HITL' or 'AFK'. HITL slices require human interaction, such as an architectural decision or a design review. AFK slices can be implemented and merged without human interaction. Prefer AFK over HITL where possible.

<vertical-slice-rules>
- Each slice delivers a narrow but COMPLETE path through every layer (schema, API, UI, tests)
- A completed slice is demoable or verifiable on its own
- Prefer many thin slices over few thick ones
</vertical-slice-rules>

### 4. Quiz the user

Present the proposed breakdown as a numbered list. For each slice, show:

- **Title**: short descriptive name
- **Type**: HITL / AFK
- **Blocked by**: which other slices (if any) must complete first
- **User stories covered**: which user stories from the PRD this addresses

Ask the user:

- Does the granularity feel right? (too coarse / too fine)
- Are the dependency relationships correct?
- Should any slices be merged or split further?
- Are the correct slices marked as HITL and AFK?

Iterate until the user approves the breakdown.

### 5. Create the tasks file

Create or update **`.awf/tasks.json`**, which contains an array of task items. For each approved slice, create a task item. Use the template below.

The **source PRD** for every task is the markdown file at **`.awf/prd.md`** (see step 1). Tasks reference that document by section or heading in `what_to_build`.

Create tasks in **dependency order** (blockers first): every dependency must appear at a **lower index** than the task that depends on it. The `blocked_by` field lists **zero-based indices** into the same **`.awf/tasks.json`** array—only indices of tasks that appear earlier in the file. Use `[]` when there are no blockers.

<task-template>

Each task in **`.awf/tasks.json`** is one object with this shape (must satisfy **[`spec/tasks.schema.json`](https://github.com/f-elix/awf/blob/main/spec/tasks.schema.json)**):

```json
{
  "title": "Short descriptive name for this slice",
  "what_to_build": "Concise description of this vertical slice. Describe the end-to-end behavior, not layer-by-layer implementation. Reference specific sections or headings of .awf/prd.md rather than duplicating content.",
  "acceptance_criteria": [
    "Criterion 1",
    "Criterion 2",
    "Criterion 3"
  ],
  "blocked_by": [],
  "user_stories_addressed": [3, 7],
  "comments": [],
  "commit_messages": [],
  "done": false
}
```

- `blocked_by`: zero-based indices of other tasks in the same array that must complete first (e.g. `[0]` means “blocked by the first task”). Only use indices **less than** this task’s own index. Use `[]` when there are no blockers.
- `user_stories_addressed`: numeric IDs of user stories as numbered in **`.awf/prd.md`**.
- `comments`: always `[]` when this skill creates or updates tasks (array of strings). The implementing agent appends short notes—what was shipped, partial progress, blockers, or follow-ups—especially when the task is not fully complete (`done` still `false`).
- `commit_messages`: always `[]` when this skill creates or updates tasks (array of strings). The implementing agent appends a concise git commit message for each commit made while implementing the task.
- `done`: always `false` when this skill creates or updates tasks. The agent that implements the task sets it to `true` when the work is complete.

</task-template>

Do NOT delete or overwrite **`.awf/prd.md`** while breaking the PRD into tasks. Editing the PRD itself is a separate, intentional change—this workflow only adds or updates **`.awf/tasks.json`**.
