# 系列播放清單自動化測試拆解計畫

## 1. 文件目的

本文件將 [`SERIES_PLAYLIST_SPEC_TEST.md`](./SERIES_PLAYLIST_SPEC_TEST.md) 的 QA 基線，進一步拆成可執行的自動化測試工作項目，作為後續 `Developer` 與 `QA` 協作的落點清單。

此文件不取代 `Spec. Test`，而是回答以下問題：

- 這個主題應該先從哪一層測試下手
- 哪些案例適合 `Vitest`
- 哪些案例適合 `Playwright`
- 哪些功能值得先拆成可測的純邏輯

## 2. 測試分層策略

### 2.1 單元測試 (`Vitest`)

適合放在純邏輯、資料解析與狀態判斷：

- 判斷輸入 CID 屬於單片模式或系列模式
- 解析與驗證 `playlist.json` 最小契約
- 找出第一個可播放集數
- 判斷待播初始化是否應寫入觀看歷史
- URL / 分享 / 歷史紀錄是否能區分系列 CID 與集數識別

### 2.2 元件 / 組合測試 (`Vitest` + 現有 template / script contract style)

適合放在介面結構與事件契約：

- 系列播放清單區塊是否存在
- 右側集數清單與主要播放器之間的 props / event 契約
- 預設選取集數與目前選取狀態的資料流
- 單片模式與系列模式切換時，頁面殼層是否正確切換

### 2.3 E2E 測試 (`Playwright`)

適合放在完整使用者流程：

- 輸入系列 CID 後顯示播放清單
- 預設載入第一個可播放集數待播畫面，但不自動播放
- 點選其他集數後切換主要播放器內容
- 單片模式與系列模式在同一工作階段的切換
- 錯誤或空播放清單時的頁面回饋

## 3. 建議新增 / 擴充的測試檔案

### 3.1 純邏輯與工具層

- `src/utils/playlist.spec.js`
  - 驗證 `playlist.json` 最小契約解析
  - 驗證缺欄位 / 壞格式 / 空清單處理
  - 驗證第一個可播放集數選取
  - 驗證 `playlist.json` 優先於單片入口的規則

- `src/utils/url.spec.js`
  - 擴充系列模式的 URL 解析與識別
  - 驗證可同時區分系列 CID 與集數識別

- `src/utils/history.spec.js`
  - 驗證待播初始化不寫入觀看歷史
  - 驗證真正開始播放後才寫入歷史
  - 驗證歷史資料可區分系列 CID 與集數識別

### 3.2 元件 / 頁面契約層

- `src/components/series_playlist_layout.spec.js`
  - 驗證右側播放清單結構與必要 `data-testid`
  - 驗證目前選取集數的狀態標記
  - 驗證系列模式下不應自動播放的 UI 契約

- `src/App.series_playlist.spec.js`
  - 驗證單片模式 / 系列模式切換時的資料流
  - 驗證系列模式初始載入時主播放器對應第一個可播放集數
  - 驗證 `playlist.json` 缺失或錯誤時的 fallback 規則

### 3.3 E2E 層

- `e2e/series_playlist.e2e.js`
  - 驗證輸入系列 CID 後顯示播放清單
  - 驗證預設待播畫面與不自動播放
  - 驗證點選 `ep02` 後切換集數
  - 驗證空播放清單 / 壞播放清單時的錯誤回饋
  - 驗證單片模式與系列模式來回切換

## 4. 建議優先實作順序

1. `src/utils/playlist.spec.js`
   - 先把 `playlist.json` 的判斷規則固定下來，避免後續 UI 與 E2E 都在猜資料契約。

2. `src/utils/history.spec.js`
   - 先鎖住「待播初始化不算已播放」這條最容易被做歪的規則。

3. `src/App.series_playlist.spec.js`
   - 再驗證模式分流、預設選取與播放器資料流。

4. `e2e/series_playlist.e2e.js`
   - 最後補完整使用者流程，驗證 UI 與狀態整合結果。

## 5. 每層最小自動化案例建議

### 5.1 `Vitest` 最小案例

- 能辨識有效 `playlist.json`
- 能拒絕壞格式或缺欄位的 `playlist.json`
- 能找出第一個 `playable=true` 的集數
- 若第一集不可播放，會改選下一個可播放集數
- 待播初始化不會寫入觀看歷史
- 真正開始播放後才寫入觀看歷史

### 5.2 `Playwright` 最小案例

- 系列 CID 載入後，右側顯示清單，主播放器停在第一個可播放集數待播畫面
- 點選另一集後，主播放器與清單選取狀態同步切換
- 輸入單片 CID 時，不顯示系列播放清單
- 壞 `playlist.json` 不會讓頁面崩潰，且會出現錯誤回饋

## 6. 測試資料建議

若後續要落實自動化，建議準備以下固定測試資料代號：

- `CID-SINGLE-OK`
- `CID-SERIES-OK`
- `CID-SERIES-FIRST-UNPLAYABLE`
- `CID-SERIES-EMPTY`
- `CID-SERIES-BROKEN-PLAYLIST`
- `CID-BOTH-SERIES-AND-SINGLE`

並盡量讓測試資料具備穩定的標題與封面，避免 E2E 因文案或非關鍵資產波動而不穩。

## 7. 建議的開發 / 驗證節奏

- 第 1 階段：先寫 `playlist` 與 `history` 的純邏輯測試
- 第 2 階段：補 `App` / 清單 UI 的契約測試
- 第 3 階段：用 `Playwright` 驗證系列模式 Happy Path
- 第 4 階段：最後補錯誤情境與單片 / 系列切換情境

## 8. Ready 條件

當以下條件都成立時，可視為此主題已具備開始自動化測試實作的條件：

- `playlist.json` 最小契約已固定
- 系列模式與單片模式的分流規則已固定
- 「待播初始化不算已播放」已固定
- 對應的測試資料 CID 或 mock 策略已準備完成
