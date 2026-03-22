---
name: sop-sdlc
description: Project SDLC collaboration SOP. Use when Codex needs the team's standard end-to-end flow for requirements, SRS, SDD, implementation, testing, and document synchronization as a reusable project process reference.
---

# sop-sdlc

For the full human-facing process, terminology notes, and stage outputs, read `README.md`.

## Goal

- Provide one reusable SOP for the project's end-to-end SDLC collaboration flow.
- Keep requirements, design, implementation, testing, and release handoff artifacts traceable.
- Treat `PRD`, `User Story`, `SRS`, `Issue`, `SDD`, test cases, `PR`, and `Release Note` as connected delivery artifacts.

## Workflow

1. Requirement gathering: clarify the problem, business value, product context, and acceptance direction, then produce `PRD`, `User Story`, and `AC`.
2. Backlog refinement and sprint planning: evaluate technical feasibility, reject unrealistic scope, estimate effort, and produce `Sprint Backlog` plus estimates.
3. Design and test planning:
   - Keep technical design as Docs-as-Code.
   - Produce `SDD` and keep API, DB, and core-logic documentation in the repo with the code.
   - Define `Unit Test`, `Spec. Test`, `Scenario Test`, and `Edge Test`.
4. Development and delivery:
   - Before merge, require passing local `Unit Test` and the provided `Spec. Test`.
   - Let CI block merge when lint, tests, or coverage gates fail.
   - After merge, deploy to `Test Env` and hand off with `Release Note`, spec-test reference, self-test result, and prerequisites.
5. Formal testing:
   - Execute `Spec. Test`, `Scenario Test`, and `Edge Test`.
   - If issues are found, create a traceable `Issue`, send the work back for correction, and repeat the handoff flow.
   - If all layers pass, record `Sign-off`.

## Guardrails

- Do not start formal implementation before `User Story` and `AC` are clear enough.
- Do not schedule work before feasibility and timing are evaluated.
- Do not let design docs, API specs, schema descriptions, and implementation drift apart.
- Do not open a `PR` without updating the corresponding documents.
- Do not skip the minimum delivery gate: passing local `Unit Test` and the provided `Spec. Test`.
- Do not handle discovered defects only by verbal notice; create a traceable `Issue`.
- Do not treat `Spec. Test` as a replacement for `Scenario Test` or `Edge Test`.
- Do not invent internal test labels such as `US Test` without defining them clearly in the process document.

## Stop Conditions

- Requirements are still unclear, or `User Story` / `AC` are not ready for implementation.
- Feasibility, scope, or timing review rejects the item for the current sprint.
- Required Docs-as-Code artifacts such as `SDD` or linked technical docs are missing.
- Local `Unit Test`, local `Spec. Test`, or CI gates do not pass.
- `Test Env` deployment or `Release Note` handoff is incomplete.
- Testing finds blocking defects and formal sign-off has not been granted.
