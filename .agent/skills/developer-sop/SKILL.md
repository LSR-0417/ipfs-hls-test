---
name: developer-sop
description: 共通開發守則。Use when Codex should follow the team's shared development discipline across a conversation: sync `upstream` before new work, never edit `main` or `develop` directly, keep one topic per worktree and branch, keep Issue and PR information traceable, and hand off each phase to the appropriate skill.
---

# Developer SOP

如果需要完整的人類版說明、載入方式與閉環 SOP，讀 `README.md`。

## Guardrails

- 新開發開始前，先同步主要整合分支；fork workflow 優先對齊 `upstream` 的 `main` 或 `develop`。
- 嚴禁直接在 `main` 或 `develop` 上改檔；一旦要實作，就先建立 topic-specific worktree 與 branch。
- 一個開發主題對應一個 worktree、branch 與 Issue。
- 主題不夠清楚時先追問，不要搶先實作。
- 階段性任務完成後，先整理變更，再做 atomic commit。
- commit subject 與 body 要能直接成為 PR 整理素材。
- 發 PR 前先確認與最新整合分支的差異與衝突。
- PR 建立後要更新 PR 訊息，最後再交給 `$development-wrap-up` 收尾。

## Phase Handoff

- 開案與工作空間建立，使用 `$development-kickoff`
- 拆 commit 與撰寫 commit message，使用 `$git-atomic-committer`
- 整理與更新 PR，使用 `$pr-writer`
- 收尾清理，使用 `$development-wrap-up`
