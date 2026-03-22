# sop-workspace

這份 README 說明正式實作前的工作區準備。它只保留高層級原則，讓人類與 LLM 知道為什麼要先做這一步，以及該做到什麼程度。

## 1. 目的

- 從最新整合基線切出乾淨的 worktree 與 branch。
- 讓 worktree、branch、`Issue`、`User Story` 與主題之間保持可追蹤關係。
- 透過規格化 naming style，降低混亂、誤用與收尾成本。

## 2. 應作流程

- 先確認主題已收斂，且已有對應 `Issue` 與 `User Story`。
- 檢查主要工作樹狀態，確認 `main` 或 `develop` 沒有未整理修改。
- 同步主要整合分支，再從最新基線切出新的 branch 與 worktree。
- 依規格化 naming style 產生 topic slug，並用它命名 branch 與 worktree。
- 準備完成後，交給 `sop-development` 進入實作。

## 3. 禁止項目

- 嚴禁直接在 `main` 或 `develop` 上開始功能開發。
- 不要沿用髒掉的工作樹或主題不明的 branch。
- 不要使用含糊、無法追蹤主題的命名。
- 不要跳過同步主要整合分支這一步。
