---
name: sop-wrap-up
description: Inspect and clean local artifacts left after a development task. Use when a PR has already been opened and Codex must perform post-PR cleanup, inspect untracked files, stop test servers, remove safe worktrees, report every action, and decide whether the thread is safe to archive.
---

# sop-wrap-up

## Goal

- Clean only artifacts that were clearly created by the current task or thread after the PR stage.
- Inspect first, then clean, then verify.
- End with a clear answer about whether the thread is safe to archive.

## Inspect

Use these commands to build the cleanup list before deleting anything:

```bash
git status --short --branch
git worktree list --porcelain
git branch --merged main
git branch -r --merged <remote>/main
ps aux | rg "vite|playwright|npm run dev|node .*vite|<repo path>"
```

Run extra checks only when needed:

- Use `gh pr view`, `gh run list`, or other known signals to confirm whether the PR has merged.
- Inspect untracked files and known output paths for task-specific temp artifacts.
- Inspect branch upstream or remote settings before deleting a remote branch. Do not guess the remote name.

If GitHub shows the PR as merged but local `main` is stale, do not rely only on `git branch --merged main`. Prefer the GitHub merged state, or fetch first and then decide.

## Decide Ownership

- Only act on branches, worktrees, servers, temp files, and test output created by the current task.
- Do not batch-delete all merged branches.
- Do not delete the current branch or the main worktree.
- Do not delete an unmerged branch unless the user explicitly asks.
- Do not remove a worktree with uncommitted changes unless the user explicitly accepts losing them.
- Do not kill processes that are not clearly tied to this workspace.
- If unrelated user changes are present, leave them intact and call them out in the report.
- If untracked files remain, identify whether they belong to this task before deciding to remove or preserve them.

## Clean Up

Follow this order:

1. Stop test or dev servers started for this workspace.
   - Find the PID from `ps aux`.
   - Only kill processes that clearly point to the current repo path.
2. Remove temp files or test output produced by this task.
   - Examples: temporary reports, scratch files, or intermediate files created only for this run.
   - Skip anything with unclear origin and explain why.
3. Remove extra worktrees created for this task.
   - Use `git worktree remove <path>`.
   - First confirm it is not the main worktree and does not contain uncommitted changes.
4. Delete local branches created for this task if they have been merged.
   - Use `git branch -d <branch>`.
5. Delete remote branches created for this task if they have been merged.
   - Use the tracked remote, for example `git push <remote> --delete <branch>`.
   - If merge status is unclear, do not force deletion. Report it instead.

## Verify

After cleanup, rerun the inspection commands and confirm:

- Dev or test servers are stopped.
- Task-created untracked files are either removed or explicitly preserved.
- Task-created worktrees are gone.
- Task-created branches are gone locally or remotely.
- Only intentionally preserved files remain in the workspace.

If anything remains, explain:

- what it is
- why it was not removed
- what decision is still needed from the user

If nothing needs cleanup, explicitly say that no task-specific leftovers were found.

## Report

Report actual actions with short bullets:

- `Stopped:` servers or processes that were stopped.
- `Removed:` worktrees, branches, remote branches, temp files, or outputs that were removed.
- `Left intact:` items intentionally preserved and why.
- `Remaining:` anything still left; use `none` if nothing remains.

Then state one of these outcomes:

- `Cleanup complete. This thread is ready to archive.`
- `Cleanup complete, but this thread is not ready to archive yet.` Follow with the blocking reason.

## Archive

Do not archive automatically.
Only emit `::archive{...}` when the user explicitly asks to archive the thread.
