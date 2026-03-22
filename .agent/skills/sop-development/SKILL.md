---
name: sop-development
description: Manage the active implementation phase. Use when workspace setup is complete and Codex is actively implementing inside a dedicated worktree and branch, and needs guardrails for code-level reuse, scope control, changing requirements, TE-provided test baselines, validation, change hygiene, and commit readiness.
---

# sop-development

For full human-facing guidance and examples, read `README.md`.

## Goal

- Implement inside the correct worktree and branch.
- Control scope, code reuse, risk, and validation cadence.
- Keep the change set clean and explainable before commit.

## Workflow

1. Confirm the current worktree and branch match the active topic.
2. Touch only files directly related to the active topic. If unrelated changes appear, stop and explain them.
3. When you need a code capability, first check whether the repo already has a safely reusable `function`, `class`, `component`, or `module`. Reuse it instead of rebuilding it when safe.
4. If the reused implementation comes from a feature-specific module, leave an explicit note at the usage site that the dependency should be evaluated for extraction into a shared module, and create a follow-up issue or task on the git server for product-owner review.
5. If no safe reusable implementation exists, write decoupled, testable functions inside the current module.
6. If you find out-of-scope bugs, typos, or messy code during development, do not fix them inline. Mark them and create follow-up issues or tasks for owner review.
7. If requirements, design, or validation conditions change during implementation, update the corresponding issue and work with the team to sync `SRS` and `SDD` before continuing.
8. Implement according to `SDD`, the PM-provided `User Story`, and the TE-provided `Spec. Test`, `Scenario Test`, and `Edge Test`.
9. You may define implementation boundaries for those tests, such as accepted input types, min/max limits, or explicitly unsupported scenarios.
10. If some scenarios are intentionally unsupported, the pass condition becomes correct defense, blocking, or expected error handling rather than pretending to provide full support.
11. If `Scenario Test` exposes a mismatch, report it back, check whether `SDD` needs correction, and then sync implementation, issue, `User Story`, and test content.
12. Move in small steps and validate incrementally. If the change touches logic that can be unit-tested, add the corresponding unit tests whether you write them first or after the implementation.
13. If a change is genuinely not suitable for unit-test coverage, state why and add an acceptable alternative validation method.
14. Preserve enough rationale to support later atomic commits and PR summaries.
15. Once a milestone is complete, hand off to `$sop-commit`.

## Guardrails

- Never go back to `main` or `develop` to make direct edits.
- Do not write a second copy of the same responsibility before checking for reusable code.
- If you knowingly depend on a feature-specific implementation, do not hide it. Leave an explicit extraction note.
- If a feature-specific implementation should become shared, do not refactor it into a generalized module inside the current topic without owner approval.
- Do not fix out-of-scope bugs, typos, or messy code inline. Mark them and open follow-up issues instead.
- Do not mix scratch output, temporary experiments, or unrelated refactors into formal changes.
- Do not keep coding against stale requirements or stale TE tests after the baseline has changed.
- Do not patch around `Scenario Test` mismatches without checking whether the design or validation baseline must change.
- Do not wait until the end to run the first meaningful validation.
- Do not skip unit tests for logic changes, and do not leave missing tests as untracked follow-up work.
- If the current changes clearly exceed the original topic, rescope or split the work.

## Stop Conditions

- The workspace contains unrelated changes that cannot be separated safely.
- Scope drift has exceeded what the current issue can reasonably hold.
- The current `User Story`, `Spec. Test`, `Scenario Test`, or `Edge Test` baseline has changed and implementation direction is no longer clear.
- Required validation or matching unit tests are missing, so the current changes cannot be judged safely.
