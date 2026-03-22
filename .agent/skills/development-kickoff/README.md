# Development Kickoff

這份 README 說明如何開始一個新的開發主題。這是開發閉環的第一個 phase skill，負責把題目收斂、同步主線、建立 worktree / branch，並把需求追蹤落到 Issue。

## 什麼時候用

適合在以下情境使用：

- 新對話準備進入實作
- 使用者只給了模糊需求，需要先收斂
- 需要從最新主線切出新的 worktree 與 branch
- 需要建立對應 Issue

## 詳細流程

### 1. 收斂主題

至少要先釐清：

- 核心問題是什麼
- 本次 in-scope / out-of-scope 是什麼
- 驗收條件是什麼
- 是否已有可沿用的 issue、branch 或 PR

如果還混著多個需求，就先拆題，讓使用者決定本輪只做哪一個主題。

### 2. 同步主要整合分支

開始前先同步主要整合分支，避免從落後基線切 branch。

fork workflow 範例：

```bash
git fetch upstream
git switch main
git pull --ff-only upstream main
```

如果實際主分支是 `develop`，就改成同步 `develop`。

### 3. 檢查目前工作樹

建議先看：

```bash
git status --short --branch
git branch --show-current
git worktree list
```

如果 `main` 或 `develop` 上已經有未提交修改，要先停下來處理，不能直接在那裡繼續開發。

### 4. 建立 worktree 與 branch

建議命名：

- branch: `codex/<topic-slug>`
- worktree: 與 repo 名和主題對應的資料夾名稱

原則：

- 一個主題一個 worktree
- 一個主題一個 branch
- 不要把舊主題的殘留修改混進來

### 5. 建立 Issue

Issue 至少應包含：

- 背景與問題描述
- 本次範圍與非範圍
- 驗收條件
- 已知風險與待確認事項

如果之後 scope 改變，Issue 也要跟著更新。

## 結束條件

完成以下事項後，就可以進入實作：

- 主題已收斂
- 主要整合分支已同步
- 新的 worktree 與 branch 已建立
- 對應 Issue 已建立或補齊
