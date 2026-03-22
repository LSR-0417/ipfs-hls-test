---
name: sop-workspace
description: Prepare the development workspace. Use when the topic is already converged, has a corresponding `Issue` and `User Story`, and Codex must sync the integration branch, verify the primary worktree is clean, derive a standardized topic slug, and create a dedicated worktree and branch before implementation starts.
---

# sop-workspace

For human-facing rationale, naming style, and examples, read `README.md`.

## Goal

- Cut a clean development workspace from the latest integration baseline.
- Keep the workspace, branch, topic, `Issue`, and `User Story` traceable to the current development baseline.
- Never start feature work directly on `main` or `develop`.
- Create the worktree and branch with standardized naming.

## Workflow

1. Confirm the topic is already converged and has a corresponding `Issue` and `User Story`.
2. Inspect `git status --short --branch`, `git branch --show-current`, and `git worktree list`.
3. Sync the integration branch. In fork workflows, align with `upstream/main` or `upstream/develop`.
4. If `main` or `develop` already contains uncommitted changes, stop and resolve the migration plan before continuing.
5. Derive the topic slug from the agreed topic.
6. Create the branch. Default naming is `codex/<topic-slug>`.
7. Create the worktree. Default path is `<repo-parent>/<repo-name>-<topic-slug>`.
8. Verify the new worktree is on the correct branch and the primary worktree remains clean.

## Guardrails

- Never start feature development directly on `main` or `develop`.
- Do not reuse a dirty worktree or an ambiguous branch for a new topic.
- Do not use vague or non-traceable branch or worktree names.
- Do not skip syncing the integration branch before cutting the new workspace.

## Stop Conditions

- The topic is still too ambiguous, or the expected `Issue` / `User Story` baseline is missing.
- The correct integration branch cannot be identified.
- `main` or `develop` contains uncommitted changes that cannot be moved safely.
- The expected branch or worktree name already exists for a different topic.
