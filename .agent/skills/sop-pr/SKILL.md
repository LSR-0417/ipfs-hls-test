---
name: sop-pr
description: Prepare and update a Pull Request. Use when implementation is complete and Codex must compare the branch against the latest integration branch, confirm merge readiness, and draft or update a concise but complete PR title and body from the issue and commit messages.
---

# sop-pr

For human-facing guidance, PR structure suggestions, and examples, read `README.md`.

## Goal

- Confirm diffs and conflicts against the latest integration branch before opening the PR.
- Produce or update a reviewable PR title and body.
- Make the PR inherit the issue and atomic commit context.

## Workflow

1. Confirm the current branch has reached a reviewable state.
2. Sync the integration branch, then inspect `git diff --stat <remote>/<branch>...HEAD` and `git log --oneline <remote>/<branch>..HEAD`.
3. If the baseline drifted or conflicts exist, resolve them locally before drafting the PR.
4. Build the PR title and body from the issue and commit messages.
5. Keep the PR write-up concise, but complete enough to express the intent of the whole code change package.
6. Explain `why` first, then summarize `what`, `validation`, and relevant risks.

## Guardrails

- The PR title should continue the naming style of the main commits and stay short and recognizable.
- The PR body should synthesize multiple commits instead of pasting them verbatim.
- If the commit bodies are already good, the PR should mainly merge, deduplicate, and reorder them.
- Do not make the PR body longer than needed when the same intent can be expressed more compactly.
- Do not make it so short that the reviewer cannot understand the intent of the whole code change package.
- Do not open the PR while obvious conflicts or abnormal diffs are still unresolved.
- Use recognizable issue-closing syntax such as `Closes #123` only when the issue should close on merge.
- If important limits, risks, or follow-up work remain, state them directly in the PR.

## Stop Conditions

- Unresolved conflicts remain against the latest integration branch.
- The current changes are not reviewable yet.
- Missing issue or commit context makes the PR write-up unreliable.
