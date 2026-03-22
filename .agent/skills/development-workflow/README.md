# Development Workflow Overview

這份 README 保留整體開發閉環的總覽，方便新加入的人快速理解整條流程。

目前建議的 skill 架構不是用這個 all-in-one skill 直接執行，而是改成：

- `@developer-sop` 載入共通守則
- `/development-kickoff` 處理開案
- `/git-atomic-committer` 處理 commit
- `/pr-writer` 處理 PR
- `/development-wrap-up` 處理收尾

`SKILL.md` 則保留成 legacy 入口，避免完全失去總覽文件。

## 開發閉環五步驟

### 1. 先同步主要整合分支

開始任何新開發前，先確認本地 `main` 或 `develop` 與主要 repository 的進度一致。

如果專案採 fork workflow，優先同步 `upstream`：

```bash
git fetch upstream
git switch main
git pull --ff-only upstream main
```

如果專案的主要整合分支是 `develop`，就改成同步 `develop`。如果沒有 `upstream`，則改以主要 remote 為準。

這一步的目的：

- 避免從落後的主線切出 branch
- 降低後續 rebase、merge 或 PR 衝突成本
- 確保接下來開出的 worktree 與 branch 是基於最新整合基線

### 2. 開 worktree 與 branch，再開始開發

禁止直接在 `main` 或 `develop` 上改檔。

當需求已經收斂成單一主題後，先建立對應的 worktree 與 branch，再開始實作。

建議先檢查：

```bash
git status --short --branch
git worktree list
```

建議命名：

- branch: `codex/<topic-slug>`
- worktree: 與 repo 名與主題對應的資料夾名稱

原則：

- 一個開發主題對應一個 worktree
- 一個開發主題對應一個 branch
- 如果主題還不清楚，先問清楚，不要先開工
- 如果目前工作樹混有 unrelated changes，要先處理風險，不要硬帶進新主題

### 3. 開發過程中做 atomic commit

當階段性任務完成後，就可以準備 commit，但前提是先整理目前所有 code changes，確認這一批變更能不能拆成多個可獨立回滾的 commit。

Atomic commit 的原則：

- 每個 commit 只處理單一邏輯目的
- 不要把順手改到但不屬於同一目的的內容塞進同一個 commit
- 同一功能直接附帶的測試與文件，可以跟主變更放在同一條 commit
- 不同目的的重構、CI、文件或清理應拆開

commit message 必須遵守規範，且內容要能直接成為後續 PR 的整理素材。

基本格式：

```text
type(optional-scope): 主題描述

- 為什麼做這個 commit
- 這個 commit 改了哪些重點
```

重點：

- subject 與 body 預設使用台灣正體中文
- `type` 與 `scope` 保留英文
- subject 優先動詞開頭，結尾不要加句號
- body 預設要有，且應該足以支撐後續 PR 內容整理

完整規範與範例請讀
`../git-atomic-committer/README.md`。

### 4. 完成任務後準備發 PR

當這個 worktree / branch 對應的任務目標完成後，就進入 PR 準備階段。

在發 PR 前，先確認：

- 與最新 `main` 或 `develop` 的差異是預期的
- 沒有混入 unrelated changes
- 若主要分支已前進，已先完成同步與衝突處理

建議檢查流程：

```bash
git fetch upstream
git diff --stat upstream/main...HEAD
git log --oneline upstream/main..HEAD
```

如果有衝突，必須先在本地處理完畢，再發 PR。不要把「開 PR 後再解」當作默認做法。

### 5. 發 PR 後更新 PR 訊息

PR 不只是送出 branch 而已，還要把 PR 描述整理完整。

PR 資訊應仿照 commit message 的寫法來整理，承接每條 commit 的 subject 與 body，讓 reviewer 可以快速理解：

- 為什麼要做這個改動
- 主要改動是什麼
- 驗證方式是什麼
- 有哪些風險、限制或後續工作

如果 commit body 已經寫得好，PR 內容應該只是整理與整合，而不是從零重寫。

## 補充 SOP

### 需求收斂

如果一開始的需求不夠清楚，先問到能收斂成單一開發主題為止。不要在題目還散的情況下直接動手。

至少要先釐清：

- 這次要解的核心問題
- 這次的範圍與非範圍
- 驗收條件
- 是否已有可沿用的 issue、branch 或 PR

### Issue 維護

主題確認後，應建立對應 Issue，並在開發過程中持續同步需求、風險、假設與決策。

Issue 至少應包含：

- 背景與問題描述
- 本次範圍與非範圍
- 驗收條件
- 已知風險與待確認事項

### 收尾

PR 建立完成且這個主題暫時沒有後續開發工作後，就進入收尾階段。

收尾 SOP 另見：
`../development-wrap-up/README.md`

## 給新開發者的提醒

- 不要直接在 `main` 改檔
- 不要跳過同步主要分支這一步
- 不要把多個目的混進同一條 commit
- 不要等到發 PR 才第一次整理你的改動脈絡
- 如果 commit body 寫不好，PR 描述通常也會一起爛掉
