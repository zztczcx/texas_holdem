---
description: "Implement the next pending stage from .kiro/specs/tasks.md — reads the spec, builds all tasks, runs checks, and commits"
mode: agent
tools: [read_file, list_dir, file_search, grep_search, replace_string_in_file, create_file, multi_replace_string_in_file, run_in_terminal, get_errors, manage_todo_list, get_terminal_output]
---

Read `.kiro/specs/tasks.md` and find the **first stage that has at least one unchecked `[ ]` task**.

Then execute the full implementation workflow for that stage:

1. **Load context**: Read `.kiro/specs/design.md`, `.github/copilot-instructions.md`, and any stage-specific reference docs mentioned in `tasks.md`
2. **Verify baseline**: Run `npm run build` — if it fails, fix all errors before writing new code
3. **Plan**: Add granular tasks to the todo list (use `manage_todo_list`)
4. **Implement**: Write all code and tests for the stage. After each TypeScript file edit, run `npx tsc --noEmit` and fix errors immediately.
5. **Verify** (all must pass with zero errors):
   - `npx tsc --noEmit`
   - `npm run lint`
   - `npm test -- --run`
6. **Update spec**: In `.kiro/specs/tasks.md`, change `[ ]` to `[x]` for every completed task in this stage
7. **Commit**: `git add -A && git commit -m "<type>: <description>"`

After the commit, **immediately start the next pending stage** without stopping.

Continue until all stages in `.kiro/specs/tasks.md` are marked `[x]`.
