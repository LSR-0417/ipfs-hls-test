---
name: role-skill-writer
description: Local skill authoring preferences for this repo. Use when Codex is creating, renaming, or refactoring skills under `.agent/skills` and must follow this repo's preferred naming, language split, role/SOP architecture, and documentation structure.
---

# role-skill-writer

For full rationale, human-facing conventions, and structural guidance, read `README.md`.

## Goal

- Apply the repo's preferred conventions when creating or updating local skills.
- Keep `SKILL.md` token-efficient and stable for model consumption.
- Keep `README.md` detailed and human-facing.

## Naming

- Use lowercase ASCII hyphen-case for skill names and folder names.
- Do not use Chinese in skill ids or folder names.
- Use English identifiers for skill names.
- Use `role-*` for role skills and `sop-*` for reusable cross-role SOP skills.
- Make the `README.md` H1 match the skill name and folder name exactly.

## Language Split

- Write `SKILL.md` in English.
- Write `README.md` in Traditional Chinese, and treat it as the canonical source of truth.
- `README.md` may also serve as the record for references, source links, and other human-facing background material.
- Keep UI-facing metadata such as `display_name` and `short_description` in Traditional Chinese.
- It is acceptable for `default_prompt` to remain in English.
- If a skill must output Traditional Chinese or another specific language, state that rule explicitly inside `SKILL.md`.
- Update `README.md` first, then derive `SKILL.md` from it.
- Only derive or refresh `SKILL.md` when the editor explicitly instructs the conversion from `README.md`.
- Treat `SKILL.md` as an English, compressed, model-facing projection of `README.md`, not as the primary authoring surface.

## Skill Boundaries

- Keep only trigger-critical rules, workflows, and guardrails in `SKILL.md`.
- Move rationale, examples, style explanations, and human-facing detail to `README.md`.
- Avoid duplicating the same explanation across `SKILL.md` and `README.md`.
- When compressing `README.md` into `SKILL.md`, reduce token cost without changing the intended behavior, scope, or guardrails.
- When converting `README.md` into `SKILL.md`, strip hyperlinks and reference-tracking content that does not affect execution behavior.
- Do not proactively rewrite `SKILL.md` every time `README.md` changes; wait for an explicit conversion request from the editor.
- When updating an existing skill, normalize it toward these preferences unless the user explicitly asks otherwise.

## Preferred Architecture

- Role skills define baseline literacy, responsibilities, collaboration rules, solo operation, role stance, adaptability, and basic requirements.
- SOP skills define reusable executable phase workflows.
- If kickoff contains role-specific judgment, keep that judgment in the role skill and let the SOP skill execute the concrete workflow.

## README Conventions

- For SOP skills, prefer high-level human-facing structure over detailed procedural overload.
- Default SOP README structure: `1. 目的`, `2. 應作流程`, `3. 禁止項目`.
- For role skills, write from the perspective of baseline professional standards rather than step-by-step execution.
- Collaboration subsections in role READMEs should use `...協作準則` wording when they describe role-specific principles.
