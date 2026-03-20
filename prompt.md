@awf/tasks.json

# TASKS

Tasks JSON is provided at start of context. 

You've also been passed the current progress of the work. Review it to understand what work has been done.

# TASK SELECTION

Pick the next task. Prioritize tasks in this order:

1. Critical bugfixes
2. Tracer bullets for new features

Tracer bullets comes from the Pragmatic Programmer. When building systems, you want to write code that gets you feedback as quickly as possible. Tracer bullets are small slices of functionality that go through all layers of the system, allowing you to test and validate your approach early. This helps in identifying potential issues and ensures that the overall architecture is sound before investing significant time in development.

TL;DR - build a tiny, end-to-end slice of the feature first, then expand it out.

3. Polish and quick wins
4. Refactors

If all tasks are complete, output <promise>COMPLETE</promise>.

# EXPLORATION

Explore the repo and fill your context window with relevant information that will allow you to complete the task.

# EXECUTION

Complete the task.

# COMMIT

Write a commit message that MUST:

1. Include task completed
2. Key decisions made
3. Files changed
4. Blockers or notes for next iteration

Keep it concise.

Write the message in the `commit_messages` array of the task item.

# THE TASK

If the task is complete, change the `done` property of the task item from `false` to `true`.

If the task is not complete, leave a comment in the `comments` property of task item.

# FINAL RULES

ONLY WORK ON A SINGLE TASK.