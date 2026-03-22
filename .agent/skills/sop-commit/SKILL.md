---
name: sop-commit
description: Split atomic commits from `git diff`, staged changes, file changes, or a change summary, and write full Git commit messages. Use when Codex must decide commit boundaries, write `type(optional-unit): description` subjects, produce clear body bullets and footer trailers, and generate commit messages that can later be reused in a PR.
---

# sop-commit

Generate complete Git commit messages that follow atomic commit principles. Analyze the real changes first, then decide whether the output should be one commit or multiple commits.

For detailed conventions, examples, sources, and repo-specific overrides, read `README.md`.

## Goal

- Split changes into atomic commits that are understandable and reversible.
- Produce commit messages that are clear and complete enough to roll directly into a PR.
- Keep this repo's commit subject, body, and footer conventions consistent.

## Workflow

1. Read the available `git diff`, `git diff --cached`, `git status --short`, change summary, or request context.
2. Group changes by one logical purpose, not by file path alone.
3. Split feature work, fixes, docs changes, test-only maintenance, CI changes, build changes, and unrelated refactors into separate commits when they serve different purposes.
4. For each group, write the subject as `type(optional-unit): description`.
5. Choose `type` from `feature`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, or `revert`.
6. Treat `optional-unit` as a weak English mapping to a module, subsystem, page, component type, or function area. It does not need to match code names exactly, but it should stay reasonably consistent within the repo.
7. Keep the subject concise. Aim for about 50 characters and avoid exceeding 72 characters without a strong reason.
8. Add a body by default. Prefer 2 to 4 flat bullets covering the change goal, the actual change, validation, and relevant limits or risks.
9. Keep body lines near 72 characters. Wrap long content instead of writing one dense line.
10. Add footer trailers only when needed for issue links, review metadata, breaking changes, or revert details.
11. Use common trailer keys such as `Refs:`, `Related:`, `Closes:`, `Fixes:`, `Co-authored-by:`, `Reviewed-by:`, or `BREAKING CHANGE:`.
12. Unless the team has an explicit different language rule, use Traditional Chinese for the description and body in this repo.
13. Once commit groups are stable, hand off the resulting history to `$sop-pr`.

## Guardrails

- Do not mix unrelated changes into one commit.
- Do not leave the body empty when it is needed to explain intent, validation, or limits.
- Do not use a vague subject that cannot support later PR writing.
- Do not use repo-inconsistent `type` names or invent unnecessary trailer formats.
- Do not close an issue too early with `Closes:` or `Fixes:` when the work is only an intermediate checkpoint.
- Do not let body lines become unreadably long.

## Stop Conditions

- The current changes cannot be summarized as one or more coherent logical groups yet.
- Validation, intent, or scope is still unclear enough that the body would be misleading.
- The proposed subject is still too vague, too long, or inconsistent with the repo convention.
- Issue-closing or breaking-change trailers are still ambiguous and would risk misleading downstream PR or release notes.

## Output Rules

- If only one commit is needed, output only the complete commit message block, with no quotes or extra commentary.
- If multiple commits are needed, output each full commit message block in order, separated by a single line containing `---`.
- Do not explain the split logic unless the user explicitly asks for it.
