# Agentic workflow run

You are executing **one task** from the workflow backlog in `./awf/tasks.json`.

## How to work

1. Read the full `./awf/tasks.json` payload appended below this document (it may have been updated since the last iteration).
2. Pick **a single** incomplete task (`done` is not `true`). Prefer critical fixes, then small end-to-end slices, then polish, then refactors—unless the backlog orders otherwise.
3. Do the work: explore the repo, implement, and validate against that task’s acceptance criteria.
4. **Validate the change before you call the task done:** read the workspace root `package.json`, inspect `scripts`, and run whatever is defined there for **lint**, **format check** (verify formatting; prefer check-only scripts like `fmt:check` or `format:check` over blind `--write` if both exist), and **tests**—use the project’s actual script names, not assumed ones. Respect `packageManager` when invoking them (e.g. `pnpm run …`, otherwise `npm run …`). Fix failures you can attribute to your edits. If a script fails for unrelated or environmental reasons, record the output summary under `comments` and still only mark `done` when this task’s acceptance criteria are satisfied and your change is not the cause of the failure.
5. Update the task in `./awf/tasks.json`: set `done` to `true` when finished, or add a note under `comments` if blocked. Append a concise entry to `commit_messages` describing what shipped.

## Completion

When **every** task in `./awf/tasks.json` has `done: true`, add **one final line** to your reply that contains **only** the completion marker below (tags included)—no spaces or other characters on that line before or after.

The runner treats **any** occurrence of that exact marker anywhere in your reply as “all tasks complete” and stops the loop. Until you are truly finished, **never** type that marker in your narrative: not in explanations, negations, examples, markdown, or “meta” commentary (e.g. do not write “no completion marker” by spelling out the marker). If you need to refer to it early, say **the completion line** or **the all-done marker** without the literal tags.

The completion line to emit when truly finished:

`<promise>COMPLETE</promise>`
