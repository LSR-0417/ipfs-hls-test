---
name: development-workflow
description: Legacy 全流程總覽。Use only when the user explicitly wants an all-in-one overview of the team's end-to-end development loop; for actual execution prefer `$developer-sop` plus the phase skills `$development-kickoff`, `$git-atomic-committer`, `$pr-writer`, and `$development-wrap-up`.
---

# Development Workflow

這是舊的全流程總覽入口。

如果要實際執行，優先使用：

- `$developer-sop` 作為共通守則
- `$development-kickoff` 處理開案
- `$git-atomic-committer` 處理 commit
- `$pr-writer` 處理 PR
- `$development-wrap-up` 處理收尾

完整總覽仍放在 `README.md`。

## Non-Negotiables

- 每個新討論都必須先收斂成單一、可實作的開發主題。
- 嚴禁直接在 `main` 上修改任何檔案；只要要動 code、文件或設定，就先建立對應的 worktree 與 branch。
- 一個開發主題對應一個 worktree、branch 與 Issue。
- 範圍不清楚時先主動發問，不要搶先實作。
- 開發途中只要 scope 漂移，就要同步更新 Issue 與後續 PR 內容。

## Workflow

1. 先載入 `$developer-sop` 作為共通守則。
2. 開案與工作空間建立，交給 `$development-kickoff`。
3. 階段性提交，交給 `$git-atomic-committer`。
4. PR 準備與更新，交給 `$pr-writer`。
5. 任務告一段落後，交給 `$development-wrap-up` 收尾。

## Stop Conditions

遇到以下情況先停止實作並向使用者確認：

- 開發主題仍然模糊，無法收斂成單一工作項目
- 需要改檔，但目前仍停留在 `main`
- 當前 worktree 或 branch 混有不屬於這個主題的修改
- 無法建立 Issue 或 PR，且阻塞點會影響流程完整性
- 與 `main` 的衝突處理牽涉需求或策略判斷，不適合自行決定
