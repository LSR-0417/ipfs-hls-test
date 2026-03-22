# Git Atomic Committer

這份 README 放詳細規範、使用情境、範例與出處。`SKILL.md` 只保留實際執行時一定要帶進上下文的核心規則。

## 什麼時候用

適合在以下情境使用：

- 使用者同意 commit，現在要分析目前變更並拆成 atomic commits
- 需要幫每條 commit 決定 `type(scope): subject`
- 需要產出完整 commit body，讓內容之後能直接整理進 PR
- 需要確認這個 repo 的 commit 口吻與 Conventional Commit / Angular-style 的差異

## 標準輸出格式

```text
type(optional-scope): 主題描述

- bullet 1
- bullet 2

BREAKING CHANGE: ...
Closes #123
```

不是每條 commit 都需要 footer。

## 詳細規則

### 1. 拆分原則

- 以「單一邏輯目的」拆 commit，而不是以檔案數量或副檔名拆分。
- 可以獨立回滾的內容就應拆開。
- 同一功能直接附帶的測試與文件可放同一條 commit。
- 不同目的的重構、CI、建置、清理或文件更新應拆開。

### 2. Header 規則

格式：

`type(optional-scope): 主題描述`

規則：

- `type` 用英文，允許：`feature`、`fix`、`docs`、`style`、`refactor`、`perf`、`test`、`build`、`ci`、`chore`、`revert`
- `scope` 只有在確實能幫助辨識模組時才加，例如 `player`、`ui`、`api`
- `subject` 用台灣正體中文
- 優先動詞開頭，接近祈使或直接陳述的語氣
- 結尾不加句號
- 優先 50 字內，最多不超過 70 字元
- 這個 repo 一律使用 `feature`，不用 `feat`

### 3. Body 規則

- subject 後空一行
- 預設要有 body
- 優先用 2 到 4 個 flat bullets
- 內容優先說明：
  - 為什麼做這個 commit
  - 這個 commit 改了哪些重點
  - 驗證、限制或風險，有才寫
- `how` 只在不寫就很難理解改動時才補

### 4. Footer 規則

- 只有在需要時才寫 footer
- 破壞性變更用 `BREAKING CHANGE:`，並補上影響與遷移資訊
- issue 關聯用 `Closes #123` 或 `Fixes #123`
- 中途提交若不應直接關閉 issue，不要過早使用 `Closes`
- `revert` commit 需在 body 裡說明被還原的 commit SHA 與原因

## Type 使用建議

- `feature`: 新增功能，或調整既有功能行為
- `fix`: 修正 bug、異常行為或錯誤處理
- `docs`: 文件、註解、說明內容更新
- `style`: 只動格式，不改邏輯
- `refactor`: 重構但不改外部行為
- `perf`: 效能改善
- `test`: 測試案例或測試基礎設施調整
- `build`: 建置流程、外部依賴、編譯設定調整
- `ci`: CI/CD 腳本或流程調整
- `chore`: 例行維護或雜項整理
- `revert`: 還原既有 commit

## 範例

### 單一 commit

```text
fix(player): 修正字幕切換後的播放狀態重置問題

- 避免播放器在切換字幕時誤觸發狀態初始化，導致播放中斷。
- 調整字幕軌切換流程，保留目前播放位置與播放狀態。
- 補上對應測試，確認切換字幕後仍可持續播放。
```

### 多個 atomic commits

```text
refactor(api): 提取 Agent API 呼叫的共用邏輯

- 讓不同 Agent 共用同一套請求流程，降低重複維護成本。
- 整理請求建立、錯誤處理與回傳解析的共用程式碼。

---

ci: 更新 Docker 建置與部署腳本

- 讓 CI 的建置流程與目前專案結構一致。
- 調整 Docker build 相關腳本與流程設定。

---

chore(test): 清除未使用的舊有測試設定檔

- 移除已經沒有被測試流程使用的舊設定檔，降低維護成本。
- 避免後續誤用過時的測試配置。
```

## 本 Repo 的本地 Override

這個 repo 沒有完全照搬外部 Conventional Commit 慣例，刻意保留以下差異：

- `feat` 改成 `feature`
- commit subject 與 body 預設使用台灣正體中文
- 預設每條 commit 都要有 body
- body 偏好用 2 到 4 個 flat bullets，方便後續整理 PR

## 參考來源

- [夜雨飄零，Git提交規範：Angular風格commit message的格式與示例](https://blog.yeyupiaoling.cn/article/1765196931805?lang=zh-tw)
- [CloudyWing's Log，淺談 Git Commit 規範](https://cloudywing.github.io/devops/%E6%B7%BA%E8%AB%87%20Git%20Commit%20%E8%A6%8F%E7%AF%84)
- [Angular，Commit message guidelines](https://github.com/angular/angular/blob/main/contributing-docs/commit-message-guidelines.md)
- [Quasar，Commit Conventions](https://quasar.dev/how-to-contribute/commit-conventions/)

## 來源補充

- 這次實際整合進規則的細節，以 Angular、Quasar 與夜雨飄零可直接驗證的內容為主。
- CloudyWing 原文連結保留作為延伸參考，但在目前抓取環境下無法穩定直接取回全文。
