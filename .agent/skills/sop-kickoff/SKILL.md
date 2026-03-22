---
name: sop-kickoff
description: Kick off a development topic. Use when a new implementation discussion begins and Codex must review the active role's problem framing, confirm PM-provided `User Story` and TE-provided `Spec. Test` as the current development baseline, call out scope or clarity problems, and decide whether the topic is ready for `sop-workspace`.
---

# sop-kickoff

For the human-facing SOP, naming notes, and examples, read `README.md`.

This skill executes the kickoff gate. The active role skill defines the lens, responsibility boundary, and decision standard used during kickoff.

## Goal

- Validate whether the current topic is ready to enter workspace setup.
- Clarify scope, acceptance, risks, and development preconditions from the active role lens.
- Confirm the current `User Story` and `Spec. Test` baseline before coding starts.

## Workflow

1. From the active role lens, confirm the core problem, scope, non-scope, acceptance, and risks.
2. Read the PM-provided `User Story` carefully. If it is too large, unclear, under-specified, or not ready for direct implementation, raise it and ask for split, clarification, or refinement.
3. Confirm the PM-provided `User Story` and TE-provided `Spec. Test` are the current development baseline.
4. Treat both `User Story` and `Spec. Test` as living artifacts. If PM or TE updates them during development, re-check the baseline and adjust direction.
5. Ensure there is still a traceable issue or equivalent tracking record before implementation proceeds.
6. Only when the `User Story`, scope, and development preconditions are clear enough should workspace setup be handed to `$sop-workspace`.

## Guardrails

- Do not start coding directly from a vague topic.
- Do not assume the first version of `User Story` or `Spec. Test` is final.
- Do not ignore scope size, clarity gaps, or missing acceptance detail just to start faster.
- Do not proceed without a traceable issue or equivalent tracking context.
- Do not enter workspace setup unless the current baseline is clear enough for implementation.

## Stop Conditions

- The topic is still too vague to frame as an implementation-ready work item.
- The `User Story` is too large, unclear, or inconsistent to use as a safe development baseline.
- The required `Spec. Test` baseline is missing, stale, or clearly not aligned with the current topic.
- Traceability is missing because there is no usable issue or equivalent tracking record.
