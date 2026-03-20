# Agentic workflow run

You are executing **one task** from the workflow backlog in `tasks.json`.

## How to work

1. Read the full `tasks.json` payload appended below this document (it may have been updated since the last iteration).
2. Pick **a single** incomplete task (`done` is not `true`). Prefer critical fixes, then small end-to-end slices, then polish, then refactors—unless the backlog orders otherwise.
3. Do the work: explore the repo, implement, and validate against that task’s acceptance criteria.
4. Update the task in `tasks.json`: set `done` to `true` when finished, or add a note under `comments` if blocked. Append a concise entry to `commit_messages` describing what shipped.

## Completion

When **every** task in `tasks.json` has `done: true`, respond with **only** this exact line (including tags) as part of your visible reply so the runner can stop:

`<promise>COMPLETE</promise>`

Until then, do **not** emit that sigil.
