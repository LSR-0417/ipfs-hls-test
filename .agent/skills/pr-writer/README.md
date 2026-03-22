# PR Writer

這份 README 說明 PR 階段的實務 SOP。這個 skill 的目標不是單純「幫忙寫一段 PR 描述」，而是先確認分支已準備好，再把 Issue 與 commit 的資訊整理成 reviewer 看得懂的 PR。

## 什麼時候用

適合在以下情境使用：

- worktree / branch 的任務目標已完成
- 準備發 PR
- 已發 PR，但需要補完整 title / body
- 需要把多條 atomic commit 整理成一份 PR 說明

## PR 前檢查

在真正送出 PR 前，先對齊最新整合分支。

範例：

```bash
git fetch upstream
git diff --stat upstream/main...HEAD
git log --oneline upstream/main..HEAD
```

至少要確認：

- 差異是預期的
- 沒有混入 unrelated changes
- 與最新整合分支沒有未處理衝突

如果有衝突，先在本地解完，再發 PR。

## PR 內容怎麼寫

好的 PR 應該承接 Issue 與 commit，而不是重頭發明一份新的說明。

建議結構：

- 背景 / 為什麼要做
- 主要改動
- 驗證方式
- 風險、限制或後續工作

如果 commit body 已經寫得完整，這一步應該主要是在：

- 合併重複資訊
- 調整順序
- 補齊 reviewer 需要的上下文

## PR Title

PR title 不需要完全照抄某一條 commit subject，但應延續同樣的命名語氣：

- 簡短
- 直接
- 可辨識主要改動

## Issue 關聯

如果這個 PR merge 後應關閉 issue，PR 內可以使用：

- `Closes #123`
- `Fixes #123`

如果只是中間階段的 PR，或 issue 不應在 merge 後立即關閉，就不要亂用。
