---
name: development-wrap-up
description: 檢查並清理開發工作結束後在本機工作區留下的遺留物，例如為當前對話建立的 worktree、branch、測試伺服器、暫存檔、報告檔與其他 thread-specific artifacts。Use when a task is finished, a PR has been merged or abandoned, and Codex needs to perform end-of-task cleanup, verify what remains, report every cleanup action, and tell the user the thread is ready to archive.
---

# Development Wrap Up

## Goal

- 只清理當前對話或當前任務明確產生的遺留物。
- 先盤點，再清理，再驗證。
- 遇到 ownership 不明、分支未合併、worktree 有修改或程序來源不明時停止刪除並向使用者說明。

## Inspect

先用這些檢查建立清單，再決定要不要刪除：

```bash
git status --short --branch
git worktree list --porcelain
git branch --merged main
git branch -r --merged <remote>/main
ps aux | rg "vite|playwright|npm run dev|node .*vite|<repo path>"
```

有需要時再補查：

- 用 `gh pr view`、`gh run list` 或其他已知資訊確認 PR 是否已經 merge。
- 用 untracked files 與已知輸出路徑確認這個對話留下的暫存檔。
- 用 branch upstream 或 git remote 設定確認該刪哪個 remote branch，不要猜 remote 名稱。

如果 PR 已經在 GitHub merge，但本地 `main` 還沒更新，不要只靠 `git branch --merged main` 判定 branch 是否安全可刪。優先使用 GitHub 的 merged 狀態，或先 `git fetch` 後再判定。

## Decide Ownership

- 只處理當前對話建立的 branch、worktree、伺服器、暫存檔與測試輸出。
- 不要批次刪除所有 merged branches。
- 不要刪除目前所在 branch 或主要 worktree。
- 不要刪除未合併 branch，除非使用者明確要求。
- 不要移除帶有未提交修改的 worktree，除非使用者明確接受丟棄變更。
- 不要 kill 與這個 workspace 無明確關聯的程序。
- 遇到使用者自己的未相關修改時保留不動，並在回報中點出。

## Clean Up

依照這個順序執行：

1. 停掉當前 workspace 啟動的測試或開發伺服器。
   - 從 `ps aux` 找出 PID。
   - 只 kill 明確指向目前 repo 路徑的程序。
2. 移除當前對話產生的暫存檔或測試輸出。
   - 例如臨時報告、scratch files、只為這次操作建立的中介檔。
   - 對來源不明的檔案跳過並說明原因。
3. 移除當前對話建立的額外 worktree。
   - 用 `git worktree remove <path>`。
   - 先確認不是主要 worktree，且裡面沒有未提交修改。
4. 刪除當前對話建立、且已完成合併的 local branch。
   - 用 `git branch -d <branch>`。
5. 刪除當前對話建立、且已完成合併的 remote branch。
   - 用該 branch 的 tracked remote，例如 `git push <remote> --delete <branch>`。
   - 無法確認 merge 狀態時不要硬刪，直接在回報中說明。

## Verify

清理後重新執行盤點指令，確認：

- 開發或測試伺服器已停止。
- 當前任務建立的 worktree 已移除。
- 當前任務建立的 branch 已從 local 或 remote 消失。
- workspace 內只剩下應保留的檔案。

如果還有殘留，逐項說明：

- 剩下的是什麼
- 為什麼沒有移除
- 需要使用者做什麼決定

如果沒有任何東西需要清理，也要明確說「沒有發現屬於這次對話的遺留物」。

## Report

用精簡條列回報實際動作：

- `Stopped:` 列出停止的伺服器或程序。
- `Removed:` 列出移除的 worktree、branch、remote branch、暫存檔。
- `Left intact:` 列出刻意保留的項目與原因。
- `Remaining:` 列出尚未清掉的項目；若沒有就寫 `none`。

最後加一句：

`清理完畢，可以將這個對話封存。`

## Archive

不要自動封存對話。
只有在使用者明確要求封存時，才輸出 `::archive{...}`。
