---
name: development-kickoff
description: 啟動一個新的開發主題。Use when a new implementation discussion starts and Codex needs to converge the topic, sync the integration branch with `upstream`, ensure no edits happen on `main` or `develop`, create a topic-specific worktree and branch, and create or update the tracking Issue.
---

# Development Kickoff

如果需要完整的人類版 SOP、命名建議與操作範例，讀 `README.md`。

## Goal

- 收斂成單一、可實作的開發主題。
- 在動手前同步主要整合分支。
- 建立對應的 worktree、branch 與 Issue。

## Workflow

1. 先確認核心問題、範圍、驗收條件與是否已有可沿用的 issue / branch / PR。
2. 主題不清楚時先追問，直到能用一句話描述成單一工作項目。
3. 檢查 `git status --short --branch`、目前 branch 與 `git worktree list`。
4. 同步主要整合分支；fork workflow 優先對齊 `upstream` 的 `main` 或 `develop`。
5. 確認不在 `main` 或 `develop` 上直接改檔；若使用者已在主分支上產生未提交修改，先說明風險並處理遷移方案。
6. 建立 topic-specific worktree 與 branch，預設 branch 名稱使用 `codex/<topic-slug>`。
7. 建立或更新對應 Issue，至少記錄背景、範圍、驗收條件、風險與待確認事項。

## Stop Conditions

- 主題仍然模糊，無法收斂成單一工作項目。
- 主分支已有未提交修改，且無法安全移走。
- 無法確認應該對齊哪個主要整合分支。
- 無法建立 Issue，且這會影響後續開發追蹤。
