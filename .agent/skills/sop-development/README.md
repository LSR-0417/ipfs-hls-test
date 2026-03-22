# sop-development

這份 README 說明 worktree / branch 準備完成後，到進入 commit 前的開發執行階段。它只保留高層級規則，避免 README 自己變成另一份過細的操作腳本。

## 1. 目的

- 在正確的工作區內推進當前主題。
- 控制 scope、重用、測試與驗證節奏。
- 讓後續 commit、PR 與收尾都建立在乾淨且可解釋的變更上。

## 2. 應作流程

- 全程只在對應主題的 worktree / branch 上開發。
- 需要某個程式碼能力時，先確認專案裡是否已有可安全複用的 `function`、`class`、`component` 或 `module`；能複用就優先引用。
- 若引用來自專用功能模組，留下應評估抽共用模組的標記，並在 git server 上建立 follow-up issue 或 task 回報，方便 product owner 判斷是否另案處理。
- 若開發中發現本次任務範圍外的 bug、錯字或技術債，也只做標記與 follow-up Issue，不直接併入當前主題。
- 若開發過程導致需求、設計或驗證條件變動，應同步更新對應 Issue，並與團隊協作更新 SRS、SDD，讓需求文件與實作保持一致。
- RD 應依 SDD 與 PM 提供的 `User Story`，以及 TE 提供的 `Spec. Test`、`Scenario Test`、`Edge Test` 實作功能。
- RD 可以針對這些測試情境進行實作邊界限定，例如明確定義 `Input Box` 可接受的型別、上下限範圍，或標注某些情境不實作。
- 若某些情境不實作，驗證通過標準應改為是否有正確防禦、正確阻擋，或正確回應預期錯誤，而不是假裝完整支援。
- 若 `Scenario Test` 驗出錯誤，應先回報 RD 檢查 SDD 是否需要修正，再同步調整實作、Issue、User Story 與測試內容。
- 新增或修改可單元驗證的邏輯時，不論先寫還是後補，都要補上對應 unit test。
- 以小步前進並分階段驗證，完成階段性目標後交給 `sop-commit`。

## 3. 禁止項目

- 禁止回到 `main` 或 `develop` 直接改檔。
- 不要在未確認可重用實作前就直接重造同責任邏輯。
- 不要把範圍外的 bug、typo、重構或清理順手混進目前主題。
- 不要在需求或設計已經改變後，只改 code 而不更新 Issue、SRS、SDD。
- 不要在 `Scenario Test` 已經顯示設計不一致時，只 patch code 而不回頭更新 SDD 與相關文件。
- 不要省略對應的 unit test，也不要把補測試留成未追蹤待辦。
- 不要把 scratch 檔、暫存輸出或 unrelated changes 混進正式變更。
