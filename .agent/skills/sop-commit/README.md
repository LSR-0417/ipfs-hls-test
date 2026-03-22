# sop-commit

這份 README 說明 commit 階段的高層級目標與限制。細部 message 規格、格式與例外情況留在 `SKILL.md` 與實際提交時處理。

## 1. 目的

- 把目前變更整理成可理解、可回滾的 atomic commits。
- 務必把 commit message 寫得清楚且完整，因為它應直接承接成後續 PR 內容，也是開發者與 LLM 交付脈絡的重要依據。
- 維持這個 repo 一致的 commit 命名與敘述品質。

## 2. 應作流程

- 先分析目前所有變更，依單一邏輯目的拆成一條或多條 atomic commits。
- 每條 commit subject 都用清楚的 `type(optional-unit): description`，並搭配 body 描述改動脈絡。
- 同一功能直接附帶的測試與必要文件可與主變更同 commit；不同目的的修改應拆開。
- 需要關聯 issue 或標示破壞性變更時，再補對應 footer。
- commit 完成後，交給 `sop-pr` 整理 PR。

### Subject 建議格式

commit subject 建議寫成：

```text
<type>(optional-unit): <description>
```

- `type`：全小寫英文，建議從以下常見類型中選擇：
  - `feature`
  - `fix`
  - `docs`
  - `style`
  - `refactor`
  - `perf`
  - `test`
  - `build`
  - `ci`
  - `chore`
  - `revert`
- `optional-unit`：選填，通常弱對照到專案中的模組、子系統、頁面、元件類型或功能單元即可，不需要和實際程式碼名稱完全一致。
  - 建議優先用英文。
  - 大小寫與命名風格不強制，但應在同一個 repo 內盡量保持一致。
- `description`：簡潔明瞭說明這條 commit 做了什麼改動。
  - 可依團隊規則統一使用任意語言。
  - 這個 repo 目前建議使用台灣正體中文。
- commit subject 字元數不要太長。
  - 建議控制在 `50` 字元左右。
  - 若有必要可放寬，但原則上不要超過 `72` 字元。

範例：

```text
feature(player): 新增直播緩衝重試機制
fix(auth): 修正 token 過期後未正確導回登入頁
docs(sdd): 更新播放器錯誤處理設計說明
test(form): 補上輸入邊界條件的單元測試
```

### Body 建議格式

- `body` 建議用條列式撰寫，說明這條 commit 的改動目標、改動內容與必要補充資訊。
- 建議控制在 `2` 到 `4` 個 flat bullets。
- 每行長度也不要太長。
  - 建議控制在 `72` 字元內。
  - 若內容較長，應主動換行，不要把整段擠成一行。
- 常見可放的內容：
  - 改動目標：這條 commit 主要想解決什麼問題
  - 改動內容：這次實際改了哪些行為、模組或流程
  - 驗證方式：跑了哪些測試、人工驗證了哪些情境
  - 限制或風險：還有哪些未涵蓋、暫時不處理或需要注意的地方

範例：

```text
feature(player): 新增直播緩衝重試機制

- 避免直播串流在短暫斷線後直接卡死，提升播放恢復率
- 新增播放器內部的重試狀態與退避邏輯，並補上錯誤訊息顯示
- 補上直播重連成功與重試次數耗盡的單元測試
```

### Footer 建議格式

- `footer` 建議用 key-value 形式撰寫，並盡量沿用常見的 Git trailer 命名，不要自行發明過多格式。
- 一般建議使用英文 key，後面接 `:`。
- issue / task 關聯常見寫法：
  - `Refs: #123`
  - `Related: #123`
  - `Closes: #123`
  - `Fixes: #123`
- 協作資訊常見寫法：
  - `Co-authored-by: Name <mail@example.com>`
  - `Reviewed-by: Name`
- 破壞性變更常見寫法：
  - `BREAKING CHANGE: 說明破壞性調整內容與遷移方式`

範例：

```text
Refs: #231
Reviewed-by: Alice
```

## 3. 禁止項目

- 不要把多個不相干的改動塞進同一條 commit。
- 不要只寫模糊 subject 而缺少足以支撐 PR 的 body。
- 不要在這個 repo 使用與本地規範不一致的 commit 口吻或 type。
- 不要過早用 `Closes` 或 `Fixes` 關閉不該在這條 commit 結束的 Issue。

## 參考來源

- [夜雨飄零，Git提交規範：Angular風格commit message的格式與示例](https://blog.yeyupiaoling.cn/article/1765196931805?lang=zh-tw)
- [CloudyWing's Log，淺談 Git Commit 規範](https://cloudywing.github.io/devops/%E6%B7%BA%E8%AB%87%20Git%20Commit%20%E8%A6%8F%E7%AF%84)
- [Angular，Commit message guidelines](https://github.com/angular/angular/blob/main/contributing-docs/commit-message-guidelines.md)
- [Quasar，Commit Conventions](https://quasar.dev/how-to-contribute/commit-conventions/)
