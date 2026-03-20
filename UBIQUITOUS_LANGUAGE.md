# Ubiquitous Language

## Product and execution

| Term | Definition | Aliases to avoid |
|------|------------|------------------|
| **awf** | The CLI package that runs a bounded agent loop against a project’s workflow directory and task list. | AWF (when spoken as an acronym without defining it), “the tool” (too vague) |
| **Ralph loop** | A repeat-until-done pattern: each cycle invokes the headless **agent** with an assembled prompt until the **completion sigil** appears or the **iteration budget** is exhausted. | Agent loop (unless you mean only the subprocess calls), “retry loop” |
| **Iteration** | One full cycle of spawning the **agent**, streaming output, and checking stop conditions. | Step, round (ambiguous with **task** steps) |
| **Iteration budget** | The maximum number of **iterations** allowed for one `awf run` (default 50, overridable on the CLI). | Max retries, timeout (it is not time-based) |
| **Completion sigil** | The exact string `<promise>COMPLETE</promise>` in accumulated assistant output; normal stop signal for **awf run**. | Done marker, completion token, “COMPLETE tag” |

## Workflow layout and contract

| Term | Definition | Aliases to avoid |
|------|------------|------------------|
| **Workflow directory** | The `.awf` folder under the process **current working directory**; holds **tasks.json** and optionally **prd.md**. | Config folder, “awf folder” without naming `.awf` |
| **Current working directory (cwd)** | The directory from which `awf` is run; **workflow directory** resolution is **strict cwd** (no upward walk). | Project root (only correct if the user actually `cd`’d there), repo root |
| **Workflow contract** | The normative `spec/workflow.json` document (plus referenced JSON Schema) that defines layout and **tasks.json** shape for tools and **skills**. | “The spec” alone (collides with **spec/** tree colloquially), workflow.json (ok as filename reference) |
| **Strict cwd resolution** | **Workflow directory** must be `./.awf` relative to cwd, not discovered in parents. | Auto-discover, “find nearest .awf” |

## Artifacts

| Term | Definition | Aliases to avoid |
|------|------------|------------------|
| **tasks.json** | The required JSON array of **tasks** under **workflow directory**, validated against the schema from the **workflow contract**. | Backlog file (ok in prose if tied to this file), issues list |
| **Task** | One element in **tasks.json**: a unit of work the **agent** is steered toward, with ids, dependencies, and status as defined by schema. | Ticket, story (unless explicitly the PRD story meaning), job |
| **PRD** | Optional `prd.md` in **workflow directory**: the product requirements document for the feature or effort. | Spec (ambiguous with **workflow contract** / **spec/**), requirements doc (ok if clearly this file) |
| **QA plan** | Optional `.awf/qa.md` produced by the **write-qa-plan** skill: manual verification steps in product/flow order. | Test plan (if you mean automated tests), checklist (ok informally) |
| **Tracer-bullet slice** | A thin vertical slice of implementation used when breaking a **PRD** into **tasks** such that each slice is independently grabbable. | Spike, POC (different intent), “small task” (loses the vertical-slice idea) |

## Agent integration

| Term | Definition | Aliases to avoid |
|------|------------|------------------|
| **agent** | Cursor’s headless CLI subprocess (`agent`) that **awf run** invokes with print mode, trust/force, and streaming output. | Model, ChatGPT, “the AI” (too vague) |
| **Agent prompt** | The instructions and context passed to **agent** each **iteration**, including bundled prompt text and inlined **tasks.json**, plus an optional path hint for **PRD**. | System prompt (only part of the story), “the prompt file” alone |

## Bundled skills and install layout

| Term | Definition | Aliases to avoid |
|------|------------|------------------|
| **Skill** | A folder under `skills/` in this repo containing `SKILL.md` and meant to be installed into the user’s agent skills directory. | Rule, command, plugin (unless clearly distinct) |
| **Bundled skills** | The `skills/` tree shipped with the **awf** package, copied by `awf skills install`. | Built-in prompts (skills are more than prompts) |
| **Skill install destination** | `~/.agents/skills/awf-<name>/` after `awf skills install`, where `<name>` is the immediate subdirectory name under `skills/`. | Global skills path (too vague without `awf-` prefix note) |

## Relationships

- The **workflow contract** names the **workflow directory**, required **tasks.json**, and optional **prd.md**; **skills** and the CLI link to this contract instead of restating layout.
- A **PRD** is broken into **tasks** in **tasks.json**, often as **tracer-bullet slices** with dependencies between **tasks**.
- **awf run** ties each **iteration** to one **agent** invocation using an **agent prompt** derived from bundled instructions and live **tasks.json** (and optional **PRD** path hint).
- The **Ralph loop** stops on **completion sigil** or **iteration budget**.

## Example dialogue

> **Dev:** “If I run **awf** from the wrong folder, it says it can’t find **tasks.json**—does it search parent directories?”
> **Domain expert:** “No. **Strict cwd resolution** means the **workflow directory** has to be `./.awf` under your actual **current working directory**.”
> **Dev:** “So the **agent** always sees the full **tasks.json** each **iteration**, but not inlined **PRD** text?”
> **Domain expert:** “Right—if **prd.md** exists, only its path goes into the **agent prompt** so the **agent** can open it when needed.”
> **Dev:** “And we’re done when the **completion sigil** shows up, not when every **task** is marked closed in JSON?”
> **Domain expert:** “The loop stops on the sigil or the **iteration budget**; keeping **tasks.json** statuses accurate is separate hygiene the **agent** should maintain, but it’s not what the CLI parses as the hard stop.”

## Flagged ambiguities

- **“spec”** can mean the **`spec/`** directory, the **workflow contract** file (`workflow.json`), or colloquially a **PRD**—use **workflow contract**, **tasks schema**, or **PRD** explicitly.
- **“project root”** vs **cwd**: **awf** only cares **cwd**; documentation often assumes the user’s **project root** is the same—call out when they might differ (e.g. monorepo subfolders).
