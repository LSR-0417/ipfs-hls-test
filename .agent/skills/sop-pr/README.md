# sop-pr

這份 README 說明 PR 階段應該達成的事情。它只保留高層級流程與限制，讓 PR 不只是送出 branch，而是可 review、可合併、可追蹤的整合動作。

## 1. 目的

- 確認目前分支已準備好與主要整合分支比較與合併。

## 2. 應作流程

- 對齊最新整合分支，檢查目前 branch 的差異是否符合預期。
- 若有衝突或明顯異常差異，先在本地處理，再準備發 PR。
- 把 Issue 與 commits 重點整理成 reviewer 看得懂的 PR 資訊，字數不用多，但要能完整表達這包 code change 的意圖。
- 用 Issue 與 commit message 整理 PR title / body，清楚交代背景、主要改動、驗證與風險。
- 需要在 merge 後關閉 Issue 時，再使用對應的 issue closing 關鍵字。
- PR 建立後，若資訊仍不完整，持續補齊到 reviewer 可直接理解為止。

## 3. 禁止項目

- 不要在差異未確認或衝突未處理時直接發 PR。
- 不要把 unrelated changes 混進同一張 PR。
- 不要忽略既有 commits 與 Issue，重新發明一份脫節的 PR 說明。
- 不要亂用 `Closes` 或 `Fixes` 導致 Issue 被過早關閉。
