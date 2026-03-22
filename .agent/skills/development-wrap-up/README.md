# Development Wrap Up

這份 README 放收尾 skill 的詳細使用情境與判斷補充。`SKILL.md` 保留收尾時一定要遵守的核心規則。

## 什麼時候用

適合在以下情境使用：

- 某個開發主題已經告一段落
- PR 已建立、合併或放棄，準備清理本地遺留物
- 需要確認這次對話建立的 worktree、branch、暫存檔或測試程序是否該移除

## 核心原則

- 只清理當前對話或當前任務明確產生的東西
- 先盤點，再清理，再驗證
- 遇到 ownership 不明、未合併 branch、有未提交修改的 worktree 或來源不明的程序，就不要硬刪

## 常見清理對象

- 當前對話建立的 worktree
- 已完成合併的 local / remote branch
- 當前 workspace 啟動的測試或開發伺服器
- 這次操作產生的暫存檔、報告檔、scratch 檔

## 常見保留情境

- 使用者自己的未提交修改
- 尚未合併的 branch
- 無法確認來源的程序
- 無法判定是否可刪的暫存檔

## 收尾後的回報

回報建議至少涵蓋：

- `Stopped:` 停掉哪些程序
- `Removed:` 移除了哪些 worktree、branch、remote branch 或暫存檔
- `Left intact:` 哪些東西刻意保留以及原因
- `Remaining:` 目前還剩什麼；若沒有就寫 `none`

最後再補一句：

`清理完畢，可以將這個對話封存。`
