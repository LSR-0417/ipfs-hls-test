---
name: pr-writer
description: 整理與更新 Pull Request。Use when implementation is complete and Codex needs to compare the branch against the latest integration branch, confirm merge readiness, and draft or update a PR title and body that roll up the Issue and atomic commit messages.
---

# PR Writer

如果需要完整的人類版說明、PR 結構建議與範例，讀 `README.md`。

## Goal

- 在發 PR 前確認與最新整合分支的差異與衝突。
- 產出或更新可 review 的 PR title 與 body。
- 讓 PR 內容承接 Issue 與 atomic commit 的資訊。

## Workflow

1. 先確認目前 branch 對應的任務目標已完成，或至少已達到可 review 狀態。
2. 同步主要整合分支，檢查 `git diff --stat <remote>/<branch>...HEAD` 與 `git log --oneline <remote>/<branch>..HEAD`。
3. 如果發現衝突或基線已漂移，先在本地處理完再整理 PR。
4. 從 Issue、commit subject 與 commit body 抽出 PR title、背景、主要改動、驗證方式、風險與後續工作。
5. 更新 PR 訊息，避免只貼流水帳；要先交代 why，再整理 what 與 validation。

## PR Rules

- PR title 應延續主要 commit 的命名語氣，簡短且可辨識。
- PR body 應整合多條 commit 的內容，不要原封不動逐條貼上。
- 如果 commit body 已經寫得完整，PR 只需要整合、去重與排序。
- 若 issue 關聯需要關閉，使用平台可辨識的語法，例如 `Closes #123`。
- 若目前仍有未解限制、風險或後續工作，要明確寫在 PR 內，不要藏在對話裡。

## Stop Conditions

- 與最新整合分支仍有未處理衝突。
- 目前變更尚未達到可 review 狀態。
- 缺少 Issue 或 commit 資訊，導致無法整理出可信的 PR 說明。
