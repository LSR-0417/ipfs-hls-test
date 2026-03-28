# 播放器全自訂控制層規格驗證測試 (Spec. Test)

## 文件狀態

- 狀態：Implementation baseline
- 版本：`v2`
- 性質：對應 Issue `#31` 的最低送測門檻
- 對應文件：
  - [Issue #31](https://github.com/LSR-0417/ipfs-hls-test/issues/31)
  - [`docs/PLAYER_SRS.md`](./PLAYER_SRS.md)
  - [`docs/DUAL_SUBTITLE_SRS.md`](./DUAL_SUBTITLE_SRS.md)
  - [`docs/PLAYER_PAGE_DESIGN_GUIDELINES.md`](./PLAYER_PAGE_DESIGN_GUIDELINES.md)

## 1. 文件目的

本文件定義「將播放器統一為全自訂控制層」主題的 `Spec. Test`，作為後續 RD 實作、自測與驗收的最低考卷。

本版聚焦於：

- 將目前混用的 `video.js` 內建控制與既有自訂控制收斂為單一控制層
- 保留既有播放能力、快捷鍵與操作位置意圖
- 補齊 startup gate、big play overlay、control bar、menu、slider、time/progress 等控制入口的驗證基線
- 驗證 responsive、無障礙語意與初始化失敗時的 fallback

本版不涵蓋：

- 新增本來不存在的播放器功能
- 視覺品牌大改版或 header action button 規格平移
- 播放引擎替換或移除 `video.js`
- 所有瀏覽器細節、動畫微調與效能最佳化

## 2. 對應 User Story

1. 播放器所有對使用者可見的控制入口都應收斂為自訂控制層，而不是混用框架預設控制。
2. startup gate 與 big play overlay 也屬於播放器控制層範圍，需納入一致的控制語言。
3. 第一版需保留目前既有播放能力與大致位置意圖，不因控制層重構而消失或改意。
4. 控制層需涵蓋播放、音量、進度、時間、字幕、畫質、子母畫面與全螢幕等既有操作。
5. 所有控制項需具一致的 default、hover、active、focus、disabled、loading 與 open 狀態。
6. 現有快捷鍵與行為契約需維持一致。
7. 在桌機與窄版寬度下，關鍵操作不得因控制層重構而失效或互相遮擋。
8. 控制層需維持可辨識、可鍵盤操作與正確互動語意。
9. 若自訂控制初始化失敗，播放器仍須保有最小可播放能力。

## 3. 規格解讀基線

為避免實作歧義，本版 `Spec. Test` 固定採用以下解讀：

- 「全自訂控制層」指的是使用者可見的控制語意與呈現由應用層主導，不接受外觀與狀態回饋仍明顯依賴 `video.js` 預設樣式。
- 第一版的核心目標是「收斂與統一」，不是「擴功能」；若控制層改版同時新增新功能，應另開需求或至少另列附加驗證。
- 現有控制能力至少包含：
  - startup gate 的播放入口
  - big play overlay
  - 播放 / 暫停
  - 靜音 / 音量
  - seek / progress
  - 目前時間 / 總長或剩餘時間顯示
  - 字幕總開關、主字幕入口、主次字幕交換
  - 畫質選單
  - 子母畫面
  - 全螢幕
- 「大致位置意圖」以目前播放器的視覺分區為準：
  - overlay 類控制仍位於畫面中央或播放區內
  - transport 與播放狀態資訊仍位於控制列
  - 字幕、畫質、PiP、全螢幕仍位於控制列尾端操作區
- 桌機與可 hover 裝置的控制列採雙層設計：
  - 上層為 progress rail
  - 下層為 play、time、volume 與尾端 action cluster
- 控制列可見按鈕以 icon-only 呈現，不以多語系文字 chip 作為主要
  視覺；可讀名稱需由 `aria-label` / `title` 提供。
- 音量控制固定為自訂控制：
  - 桌機與可 hover 裝置預設只顯示喇叭 icon，滑鼠 hover 或 focus
    後展開橫向音量 bar
  - 窄手機的收納設定面板內，音量維持直接可調的橫向 slider
- responsive 基線固定採以下切法：
  - `375px` 等窄手機保留雙層控制列，但次要 action 收進齒輪設定
  - `430px` 以上手機寬度保留雙層控制列，且不強制收進 settings
- 控制列顯示策略固定為：
  - 一般模式與 fullscreen 都採相同邏輯
  - 滑鼠在播放器內移動時顯示
  - 滑鼠離開播放器區域時立即隱藏
  - 單純閒置時也可進入隱藏
  - startup gate、設定 / 字幕 / 畫質等面板打開時需維持顯示
- fullscreen 基線固定使用 `video-player-shell` 作為 fullscreen 容器，
  不接受只讓 `video.js` 內層播放器進入 fullscreen，導致自訂控制列
  留在外層的實作。
- 自訂控制即使內部仍呼叫 `video.js` API，也不得把預設 control semantics 直接暴露給使用者。
- 快捷鍵維持目前 `PLAYER_SRS` 與 `src/utils/playback.js` 既有契約，不因控制層重構而改變觸發鍵與邊界條件。
- 若自訂控制初始化部分失敗，允許退回最小 fallback，但不可讓播放器變成完全無法開始播放、恢復播放或結束全螢幕。

## 4. 測試前置條件

### 4.1 測試資產

至少準備以下測試內容：

- `CID-CTRL-BASIC`
  - 可正常播放的 HLS 影片
  - 不要求字幕
- `CID-CTRL-SUB`
  - 可正常播放的 HLS 影片
  - 含至少兩條遠端字幕，例如 `en`、`zh-TW`
- `CID-CTRL-NO-SUB`
  - 可正常播放的 HLS 影片
  - 不提供字幕 manifest
- `CID-CTRL-SLOW-START`
  - 可正常播放，但初始緩衝較慢，足以觸發 startup gate

### 4.2 前端環境前置

- 清除播放器相關 localStorage，至少包含：
  - 字幕偏好
  - 畫質或 gateway 造成的殘留播放器狀態
- 確認測試環境可驗證：
  - 鍵盤輸入
  - 全螢幕 API
  - Picture-in-Picture API（若瀏覽器支援）
- 若使用 mock 或本地測試站，需可穩定控制：
  - startup gate 出現與解除
  - 有字幕 / 無字幕
  - 多畫質
  - 初始化失敗或部分控制掛載失敗的情境

## 5. Traceability

| User Story | 規格驗證案例 |
| --- | --- |
| 1 | `Spec-CTRL-001` |
| 2 | `Spec-CTRL-002` |
| 3 | `Spec-CTRL-001`, `Spec-CTRL-003`, `Spec-CTRL-004` |
| 4 | `Spec-CTRL-003`, `Spec-CTRL-004`, `Spec-CTRL-005`, `Spec-CTRL-006` |
| 5 | `Spec-CTRL-001`, `Spec-CTRL-002`, `Spec-CTRL-003`, `Spec-CTRL-004`, `Spec-CTRL-005` |
| 6 | `Spec-CTRL-007` |
| 7 | `Spec-CTRL-008` |
| 8 | `Spec-CTRL-009` |
| 9 | `Spec-CTRL-010` |
| 5, 7 | `Spec-CTRL-011` |

## 6. 規格驗證案例

### Spec-CTRL-001 控制層盤點與視覺狀態一致性

**目的**

驗證播放器中所有對使用者可見的控制入口都納入同一套自訂控制語言，且狀態回饋一致。

**前置條件**

- 載入 `CID-CTRL-SUB`
- 播放器已初始化完成

**步驟**

1. 觀察 overlay、control bar、menu 與 slider 類控制。
2. 逐一檢查 default、hover、active、focus、disabled、open 狀態。
3. 比對控制項之間的字型、icon、邊框、背景、焦點樣式與狀態回饋。

**預期結果**

1. 不存在明顯仍使用 `video.js` 預設按鈕語言的控制入口。
2. overlay、control bar、menu 與 slider 類控制共享同一套播放器專屬視覺系統。
3. 同類型狀態在不同控制項上表現一致，不出現某些控制仍沿用舊預設樣式的情況。

### Spec-CTRL-002 startup gate 與 big play overlay 納入自訂控制層

**目的**

驗證 startup gate 與 big play overlay 不再是特例，而是納入同一套控制語言與操作契約。

**前置條件**

- 情境 A：載入 `CID-CTRL-SLOW-START`
- 情境 B：載入 `CID-CTRL-BASIC`，播放器處於未播放狀態

**步驟 A：startup gate**

1. 等待 startup gate 出現。
2. 觀察按鈕樣式與可操作性。
3. 點擊播放入口。

**預期結果 A**

1. startup gate 動作按鈕使用自訂控制語言。
2. 按鈕可清楚辨識為播放入口。
3. 點擊後可正常進入播放流程。

**步驟 B：big play overlay**

1. 觀察中央播放入口。
2. 點擊一次開始播放。
3. 暫停後再次確認 overlay 或等效播放入口表現。

**預期結果 B**

1. big play overlay 使用與播放器控制層一致的設計語言。
2. 點擊後能正常開始播放，不需依賴外露的預設播放按鈕。
3. overlay 控制與控制列中的播放控制語意一致。

### Spec-CTRL-003 Transport、時間與進度控制保留既有能力

**目的**

驗證自訂控制層保留目前 transport 類操作能力與位置意圖。

**前置條件**

- 載入 `CID-CTRL-BASIC`
- 播放器已就緒

**步驟**

1. 使用控制列播放 / 暫停按鈕切換播放狀態。
2. 拖曳 progress 控制到不同時間點。
3. 觀察目前時間、總長或剩餘時間顯示。
4. 重複播放、暫停與 seek 操作。

**預期結果**

1. 播放 / 暫停控制存在且可操作。
2. progress 控制可透過點擊或拖曳進行 seek。
3. 時間資訊存在且會隨播放進度更新。
4. transport、時間與進度控制維持在既有控制列分區內，不因自訂化改變操作意圖。

### Spec-CTRL-004 音量控制為自訂控制且保持可用

**目的**

驗證靜音與音量控制也納入自訂控制層，而不是保留預設 volume UI。

**前置條件**

- 載入 `CID-CTRL-BASIC`
- 測試環境允許音量控制

**步驟**

1. 點擊靜音控制。
2. 再次點擊取消靜音。
3. 在桌機或可 hover 裝置上，將滑鼠移到音量區並確認橫向音量 bar 展開。
4. 調整音量 slider 或等效音量控制。
5. 在窄手機設定面板內再次確認音量可直接調整。
6. 觀察音量狀態與圖示 / 文案變化。

**預期結果**

1. 靜音控制存在且可切換。
2. 音量控制使用自訂控制語言，與其他控制樣式一致。
3. 桌機預設不長駐展開音量 bar，hover / focus 後才展開。
4. 調整音量會即時反映到播放器音訊狀態。
5. 靜音、低音量與正常音量的狀態回饋可被辨識。

### Spec-CTRL-005 字幕、畫質、PiP 與全螢幕控制維持可操作

**目的**

驗證尾端操作區的既有能力在自訂控制層下仍完整存在。

**前置條件**

- 載入 `CID-CTRL-SUB`
- 測試環境支援多畫質與 PiP（若瀏覽器支援）

**步驟**

1. 操作字幕總開關。
2. 打開主字幕入口並切換主字幕。
3. 於雙字幕情境下操作 `A/B` 交換。
4. 打開畫質選單並切換畫質。
5. 操作 PiP。
6. 進入並退出全螢幕。

**預期結果**

1. 字幕控制維持既有語意，不退回內建字幕選單。
2. 畫質切換入口存在且可操作。
3. PiP 與全螢幕控制存在且狀態正確更新。
4. 上述控制在視覺上屬於同一套自訂尾端操作區語言。

### Spec-CTRL-006 沒有字幕或部分功能不可用時的 disabled / hidden 規則

**目的**

驗證不同可用性狀態下，自訂控制層能正確表達 disabled、hidden 或 loading，而不是暴露預設行為。

**前置條件**

- 情境 A：載入 `CID-CTRL-NO-SUB`
- 情境 B：載入 `CID-CTRL-SUB`

**步驟 A：無字幕**

1. 觀察字幕總開關、主字幕入口與 `A/B` 交換控制。

**預期結果 A**

1. 字幕相關控制依規格呈現 disabled、loading 或 hidden。
2. 不出現預設字幕 menu button 自行冒出的情況。

**步驟 B：單一條件不足**

1. 只保留主字幕，不設定副字幕。
2. 觀察 `A/B` 交換控制。

**預期結果 B**

1. `A/B` 交換僅在條件成立時顯示。
2. 不可用狀態的控制與可用狀態仍使用同一套自訂狀態語言。

### Spec-CTRL-007 控制層重構不改變既有快捷鍵契約

**目的**

驗證控制層自訂化後，既有快捷鍵與邊界保護仍與目前契約一致。

**前置條件**

- 載入 `CID-CTRL-SUB`
- 焦點預設不在互動元素內

**步驟**

1. 依序按下 `Space`、`K`、`ArrowLeft`、`ArrowRight`、`J`、`L`、`M`、`F`、`C`、`,`、`.`、`?`。
2. 將焦點移到 `button`、`input` 或其他互動元素內後，重複部分快捷鍵。

**預期結果**

1. 各快捷鍵維持目前 `PLAYER_SRS` 既有功能。
2. 控制層重構不改變 seek 步長、字幕切換與全螢幕 / 靜音行為。
3. 焦點在互動元素內時，播放器仍遵守既有 hotkey ignore 規則。

### Spec-CTRL-008 窄版下的控制層可用性

**目的**

驗證控制層在窄版或行動裝置寬度下仍保有可操作性與關鍵控制可見性。

**前置條件**

- 載入 `CID-CTRL-SUB`
- 至少驗證兩組寬度：
  - `375px`
  - `430px`

**步驟**

1. 在 `375px` 觀察 overlay 與雙層控制列。
2. 播放影片並操作 play / progress / time / settings。
3. 打開 settings，確認音量、字幕、畫質與全螢幕入口存在。
4. 在 `430px` 再次觀察雙層控制列。
5. 確認 `430px` 下不必透過 settings 也可直接操作主要尾端 action。

**預期結果**

1. 關鍵控制不重疊、不裁切、不因空間不足而無法點擊。
2. `375px` 下次要 action 可收斂到 settings，但不影響主要播放操作。
3. `430px` 下仍維持雙層控制列，不應過度收斂到 settings。
4. 選單、slider 與 focus 狀態在窄版下仍可辨識與操作。

### Spec-CTRL-009 無障礙與互動語意

**目的**

驗證自訂控制層在全面自訂後，仍保留正確的互動語意與可存取性。

**前置條件**

- 載入 `CID-CTRL-SUB`

**步驟**

1. 以鍵盤 Tab 巡覽控制層。
2. 檢查 toggle、menu button、slider 的 ARIA 語意。
3. 開啟選單並以鍵盤操作。
4. 觀察 focus 樣式與螢幕閱讀器可讀名稱。

**預期結果**

1. 所有關鍵控制皆可透過鍵盤聚焦與操作。
2. toggle、menu、slider 具備合理可讀的語意與名稱。
3. focus 指示清楚，不因自訂樣式而消失。
4. icon-only 控制仍具備可辨識名稱，不只剩視覺圖形。

### Spec-CTRL-010 自訂控制初始化失敗時的 fallback

**目的**

驗證部分自訂控制掛載失敗時，播放器仍保有最小可播放能力，不致進入完全不可用狀態。

**前置條件**

- 可模擬部分自訂控制註冊或掛載失敗
- 載入 `CID-CTRL-BASIC`

**步驟**

1. 讓部分控制初始化失敗。
2. 載入播放器。
3. 嘗試開始播放、暫停、恢復播放與退出全螢幕。

**預期結果**

1. 播放器不會因單一自訂控制失敗而整體崩潰。
2. 使用者至少仍可開始播放或恢復播放。
3. 系統不應留下完全無法操作的黑盒狀態。

### Spec-CTRL-011 控制列顯示 / 隱藏策略一致性

**目的**

驗證一般模式與 fullscreen 的控制列顯示策略一致，且滑鼠移出播放器時可立即隱藏。

**前置條件**

- 載入 `CID-CTRL-BASIC`
- 使用桌機或可 hover 的測試裝置

**步驟**

1. 在一般模式播放影片，等待控制列顯示。
2. 停止移動滑鼠，確認控制列可收起。
3. 在播放器區域內移動滑鼠，確認控制列重新出現。
4. 將滑鼠移出播放器區域。
5. 進入 fullscreen，重複步驟 2 到 4。

**預期結果**

1. 一般模式與 fullscreen 都會在閒置時收起控制列。
2. 滑鼠在播放器區域內移動時，控制列會被喚醒。
3. 滑鼠離開播放器區域時，控制列會立即進入隱藏狀態。
4. fullscreen 下的控制列行為不依賴點擊影片才能出現。

## 7. 建議的本地驗證落點

為了讓 `Developer` 能在本地重複驗證，建議後續至少補齊以下自動化：

- [`src/utils/playback.spec.js`](/Users/iskku/Project/ipfs-hls-test-issue-31-player-custom-controls/src/utils/playback.spec.js)
  - 快捷鍵契約不變
  - `f` 快捷鍵走自訂 fullscreen 路徑
  - 互動元素 focus guard
- [`src/components/video_layout.spec.js`](/Users/iskku/Project/ipfs-hls-test-issue-31-player-custom-controls/src/components/video_layout.spec.js)
  - 控制層盤點與結構契約
  - startup gate / 自訂控制入口存在性
  - fullscreen container 與 control-surface lifecycle helper
- [`e2e/rwd.e2e.js`](/Users/iskku/Project/ipfs-hls-test-issue-31-player-custom-controls/e2e/rwd.e2e.js)
  - overlay、control bar、字幕 / 畫質 / 全螢幕等核心流程
  - 桌機 volume hover reveal 與 icon-only button surface
  - 非 fullscreen / fullscreen 的 control bar hide-show 策略
  - `375px` 與 `430px` 的窄版控制列可用性

## 8. 後續可擴充的 Scenario / Edge Test

- 不同瀏覽器對 PiP 或全螢幕支援差異下的顯示與 disabled 狀態
- 長片、直播樣式或沒有總長度時的 time/progress 呈現
- 緩衝中、錯誤中、來源切換中的 loading state 轉換
- 觸控裝置對 slider drag、tap seek 與 overlay 操作的細節
