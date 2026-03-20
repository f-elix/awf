> This project is heavily inspired by this video from Matt Pocock: https://www.youtube.com/watch?v=hX7yG1KVYhI. The original skills, also authored by Matt Pocock, can be found on [skills.sh](https://skills.sh). They have been adapted to use a local folder structure instead of Github issues. Thanks Matt for the knowledge and inspiration!

# awf

**awf** is a small CLI that runs a **ralph loop**: it repeatedly invokes Cursor’s headless **`agent`** on your repo so it can work through **one task at a time** from **`.awf/tasks.json`**, using a bundled agent prompt and your live task list until the agent emits the completion sigil or a max iteration count is reached.

Normative paths and `tasks.json` shape: **[`spec/workflow.json`](spec/workflow.json)** (and [`spec/tasks.schema.json`](spec/tasks.schema.json)).

---

## Workflow (skills + CLI)

Use this **order** when planning and executing work in a project:

| Step | What | How |
|------|------|-----|
| **1. Shape the idea** | Stress-test requirements and design choices before writing them up. | Invoke skill **`grill-me`** (or talk through the same process manually). |
| **2. PRD** | Capture problem, solution, stories, and decisions in one place. | Invoke skill **`write-a-prd`** → writes **`.awf/prd.md`**. |
| **3. Tasks** | Break the PRD into tracer-bullet slices with dependencies. | Invoke skill **`prd-to-tasks`** → creates or updates **`.awf/tasks.json`** (array of tasks; schema in `spec/tasks.schema.json`). |
| **4. Execute** | Let an agent implement tasks in a loop with shared context. | Run **`awf run`** from the **project root** (see [CLI usage](#cli-usage)). Refresh bundled skills on your machine with **`awf skills install`** after pulling the repo. |
| **5. QA plan (optional)** | Manual test plan in product/flow order, not task order. | Invoke **`write-qa-plan`** after tasks exist → writes **`.awf/qa.md`** (does not edit `tasks.json`). |

**`.awf`** must exist as a **child of your current working directory** (no searching parent folders). Required for `awf run`: **`.awf/tasks.json`**. Optional: **`.awf/prd.md`** — the CLI only adds a **path hint** to the agent prompt so the model can open it without inlining the full file.

---

## Skills in this repo

Skills live under **[`skills/`](skills/)** — one folder per skill, each with a **`SKILL.md`**:

- `skills/grill-me`
- `skills/write-a-prd`
- `skills/prd-to-tasks`
- `skills/write-qa-plan`

**Using them:** install them into your agent skills directory. Run **`awf skills install`** (from any working directory once the CLI is linked globally) to copy each **`skills/<name>`** to **`~/.agents/skills/awf-<name>/`**. The CLI creates **`~/.agents`** and **`~/.agents/skills`** if needed. The **`awf-`** prefix avoids colliding with unrelated skills in the same folder. If you copy or symlink by hand, use the same **`awf-<name>`** names under **`~/.agents/skills`**. On success the command prints one line per skill (`source -> destination`, absolute paths); stderr and a non-zero exit indicate errors. Skill bodies reference **`spec/workflow.json`** so layout and **`tasks.json`** stay aligned with the CLI.

---

## CLI usage

### Prerequisites

- **Node** ≥ 20.6  
- **[`pnpm`](https://pnpm.io/)** for installs in this repo  
- Cursor **`agent`** on your **`PATH`**, authenticated per [Cursor CLI / headless](https://cursor.com/docs/cli/headless) — `awf run` shells out with print mode, **`--force`** (files may be edited), [`stream-json` + `--stream-partial-output`](https://cursor.com/docs/cli/headless#real-time-progress-tracking), and a fixed model/trust configuration. Only **assistant text** is printed to your terminal; tool/system events stay out of the stream.

### Install the `awf` command

From a clone of this repository:

```bash
cd /path/to/awf
pnpm install
pnpm link --global
```

Then `awf` is available in your shell. To remove later: `pnpm unlink --global awf`.

Without linking, from the repo only:

```bash
pnpm awf run
pnpm awf run 10   # max 10 iterations (default is 50)
pnpm awf skills install   # copy bundled skills to ~/.agents/skills/awf-*/
```

### Install bundled skills

After linking (or via `pnpm awf skills install` from the clone):

```bash
awf skills install
```

Resolves **`skills/`** from the **linked package** (not from your current project directory), stages a full copy, then replaces each **`~/.agents/skills/awf-<skill>/`** tree. Re-run after **`git pull`** to refresh. Use **`awf skills`** or **`awf skills --help`** for the skills command group.

### Run the loop

From the **root of the project you are automating** (where **`.awf`** lives):

```bash
awf run           # up to 50 iterations
awf run 25        # up to 25 iterations
```

**Behavior (summary):**

- Loads the workflow contract and validates **`./.awf/tasks.json`** (must exist, valid JSON array, matches schema).
- Each iteration: rebuilds the agent prompt from the **bundled** instructions plus **full** `tasks.json` text; if **`.awf/prd.md`** exists, appends **only its path** relative to the project root.
- Stops when accumulated assistant text includes a **whole line** that is exactly **`<promise>COMPLETE</promise>`** (after trimming), or when the iteration budget is exhausted.
- Exits **0** when the loop finishes normally; if the budget is hit without the sigil, it still exits **0** but prints that work may be incomplete. Non-zero if **`agent`** fails to start or exits with an error.

Review diffs before committing; **`--force`** means the agent can change files without prompts.

---

## Developing awf

Install: `pnpm install`

| Script | Purpose |
|--------|---------|
| `pnpm fmt` / `pnpm fmt:check` | [Oxfmt](https://oxc.rs/docs/guide/usage/formatter.html) on `src`, `bin`, `spec` |
| `pnpm lint` / `pnpm lint:fix` | [Oxlint](https://oxc.rs/docs/guide/usage/linter.html) on `src`, `bin` |
| `pnpm check` | `tsgo` ([typescript-go](https://github.com/microsoft/typescript-go)) |
| `pnpm test` | Unit tests |

Configs: `.oxfmtrc.json`, `.oxlintrc.json`
