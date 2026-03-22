# Developer SOP

這份 README 是給人類開發者與 AI 協作者看的共通開發守則說明。它不是某個單一步驟的流程，而是整段開發對話都應遵守的基線。

## 角色定位

`developer-sop` 適合當成共通守則載入，搭配各階段 skill 使用。

- 用 `@developer-sop` 載入共通紀律
- 進入不同階段時，再用對應的 phase skill

建議搭配方式：

- 開案：`/development-kickoff`
- commit：`/git-atomic-committer`
- PR：`/pr-writer`
- 收尾：`/development-wrap-up`

## 核心守則

### 1. 先同步主要整合分支

開始新開發前，先確認本地 `main` 或 `develop` 與主要 repository 同步。採 fork workflow 時，優先同步 `upstream`。

### 2. 禁止直接在主分支改檔

`main` 與 `develop` 只能用來檢查、同步與比對，不應直接承載功能開發。

### 3. 一個主題對應一個工作空間

單一開發主題應對應：

- 一個 worktree
- 一個 branch
- 一個 Issue

### 4. 先收斂主題再開工

需求不夠清楚時，先追問到能收斂成單一主題為止。不要在範圍模糊時直接實作。

### 5. commit 與 PR 必須可追溯

- 每條 commit 應該是 atomic commit
- commit subject 與 body 應可直接承接到 PR 說明
- PR 內容應整合 commit 與 Issue，而不是從零重寫

## 為什麼拆成共通 SOP + phase skills

這個架構的目的是：

- 共通守則只載一次
- 真正重的流程只在需要時載入
- 降低單一巨型 skill 長期佔用上下文
- 讓每個階段的責任邊界更清楚

## 什麼時候不要只靠它

`developer-sop` 只負責共通守則，不會自動執行各階段流程。

它會告訴你接下來應該切到哪個 phase skill，但不會自動替你觸發：

- 不會自動建立 worktree
- 不會自動拆 commit
- 不會自動整理 PR
- 不會自動收尾
