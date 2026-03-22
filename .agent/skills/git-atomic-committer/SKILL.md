---
name: git-atomic-committer
description: 根據 `git diff`、staged 變更、檔案異動或文字摘要拆分 atomic commits，並產生完整 Git commit message。Use when Codex needs to decide commit boundaries, choose `type(optional-scope)` subjects, and write Traditional Chinese commit bodies that can be reused in a PR description.
---

# Git Atomic Committer

產生符合 Atomic Commit 原則的完整 Git commit messages。先分析實際變更，再決定要輸出一條或多條 commit。

如果需要完整規範、範例、來源或本 repo 的本地 override，讀 `README.md`。

## 核心流程

1. 先讀取使用者提供的 `git diff`、`git status`、變更摘要或需求描述。
2. 若使用者沒有提供明確內容，優先檢查 `git diff --cached`，再檢查 `git diff` 與 `git status --short`。
3. 依「單一邏輯目的」分組變更，而不是只看檔案路徑或副檔名。
4. 判斷每一組變更是否能獨立回滾；可以獨立回滾的內容就拆成不同 commit。
5. 為每一組變更挑選唯一最貼切的 type 與 scope，最後再撰寫 subject 與 body。

## 核心規則

- 功能變更、重構、CI 調整、建置設定、文件整理若屬於不同目的，必須拆成多條 commit。
- 直接支援同一功能或同一 bug 修正的測試，可以和主變更放在同一條 commit；獨立的測試維護應拆成 `test`。
- 直接支援同一功能的文件更新，可以和主變更放在同一條 commit；純文件整理應拆成 `docs`。
- 只因順手一起改到、但不影響主要目的的內容，不要硬塞進同一條 commit。
- 若同一批修改很難用一句話描述成單一目的，代表應該拆分。

## Header

格式：

`type(optional-scope): 主題描述`

1. `type` 一律用英文，只能使用 `feature`、`fix`、`docs`、`style`、`refactor`、`perf`、`test`、`build`、`ci`、`chore`、`revert`。
2. `scope` 可省略；只有在能明確幫助辨識模組或子系統時才加。
3. 主題描述一律使用台灣正體中文，優先動詞開頭，結尾不要加句號。
4. 主題盡量控制在 50 字內；真的需要時可放寬，但最多不要超過 70 字元。
5. 只使用 `feature`，不要改寫成 `feat`。

## Body

1. subject 後空一行，再寫 body。
2. 預設要有 body，且一律使用台灣正體中文。
3. 以 2 到 4 個 flat bullets 為優先，重點說明 `why` 與 `what`。
4. 驗證、限制與風險只有在 relevant 時才補，不要硬湊。

## Footer

1. 只有在需要標記破壞性變更、deprecation、issue 關聯或 revert 細節時才寫 footer。
2. 破壞性變更用 `BREAKING CHANGE:` 開頭，後面先寫摘要，再補影響範圍與必要的遷移說明。
3. issue 關聯優先使用 `Closes #123` 或 `Fixes #123` 這類可被平台辨識的格式。
4. 如果這個 commit 只是中途提交，不應提前關閉 issue，就不要濫用 `Closes`；改在 PR 或最終收斂的 commit 處理。
5. `revert` commit 的 subject 應以 `revert:` 開頭，body 需交代被還原的 commit SHA 與還原原因。

## 輸出規則

- 只需要一條 commit 時，只輸出完整 commit message 區塊，不要加引號或前後文。
- 需要拆分多條 commit 時，依序輸出多個完整 commit message 區塊，區塊之間用單獨一行 `---` 分隔。
- 不要補充你如何判斷、為何拆分、或任何額外解釋，除非使用者明確要求。
