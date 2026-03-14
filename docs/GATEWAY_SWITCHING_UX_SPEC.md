# Gateway 切換 UX 規格書

## 文件狀態
- 狀態：提案中
- 範圍：目前播放中影片的 gateway 切換流程
- 主要影響介面：`src/App.vue`、`src/components/Header.vue`、`src/components/VideoPlayer.vue`、`src/components/VideoInfo.vue`

## 問題定義
目前的 gateway 切換在技術上可用，但對影音播放器來說，體驗仍然不夠順。現況比較像是「直接把來源換掉」，而不是「有狀態、有保護、有回復機制的切換流程」。

目前實作中可觀察到的問題：

1. 套用 gateway 的動作太樂觀，畫面切換過於突兀。
   使用者點擊 `applyGateway()` 後，設定視窗會立刻關閉，但播放器只顯示泛用的 `正在載入影片...` 狀態。沒有專門的「切換中」視覺層，因此畫面看起來不穩定。

2. 切換太早破壞連續性。
   `App.vue` 在使用者切換 gateway 時，會立刻改寫來源 URL。功能上雖然正確，但在新 gateway 尚未證明能正常提供媒體前，就先放棄了舊的播放上下文。

3. 從使用者角度來看，續播行為不夠可信。
   目前程式透過 `getCurrentPlaybackTime(window)` 嘗試保留播放時間，但沒有確認：
   - 新 gateway 是否真的載入到要求的片段
   - seek 是否真的成功
   - 播放器是否真的已經切到新 gateway，而不是停在舊狀態

4. 字幕與媒體就緒被混在同一個模糊的載入階段。
   `VideoPlayer.vue` 會平行處理新來源與字幕偵測，但使用者無法判斷延遲是來自 gateway、metadata、segment，還是字幕探測。

5. 缺少優雅的失敗回退機制。
   如果目標 gateway 很慢或故障，使用者沒有明確的恢復路徑。系統沒有公開 timeout、rollback、retry 或替代 gateway 建議。

## UX 目標

1. 在 gateway 切換過程中保留使用者信心。
2. 只要技術上可行，就保留觀看連續性。
3. 讓切換感覺是有意圖、可逆、低風險的操作。
4. 清楚區分「已提出切換」、「正在連線」、「已驗證成功」、「切換失敗」。
5. 避免播放器出現空白、跳動或無法解釋的狀態。

## 非目標

1. 自動多 CDN / 多 gateway 負載平衡。
2. 兩條 live HLS 管線之間真正無縫的 segment 級接手。
3. 持續背景預抓所有 gateway。
4. 第一版就做完整的網路效能基礎設施。

## UX 原則
Gateway 切換應該更像「換路徑」，而不是「重載整個播放器」。

使用者應該感受到：
- 目前的播放位置是被保護的
- 系統正在測試一條新路徑
- 即使失敗也不會把他丟在半路
- 成功時有明確確認

## 建議互動模型

### 摘要
當使用者切換 gateway 時，App 應進入暫時性的切換模式，並提供明確的 overlay 與可回退的轉場。舊播放 session 在新 gateway 驗證成功前，都仍然是參考狀態。

### 核心模式
1. 使用者開啟 Gateway Settings。
2. 使用者選擇目標 gateway。
3. 使用者點擊 `Apply`。
4. 視窗關閉，播放器進入 `Switching Gateway` 模式。
5. 目前影片畫面仍保留在畫面上方，只覆蓋一層 loading veil。
6. App 嘗試從新 gateway 載入同一個 CID，並帶入目前播放時間。
7. App 驗證播放是否就緒。
8. 若成功：
   顯示成功提示，並依規則恢復播放。
9. 若失敗：
   還原上一個 gateway，並提供重試路徑。

## 播放器 UX 狀態

### 1. Idle
一般播放狀態，沒有任何 gateway 切換進行中。

可見提示：
- Gateway 按鈕顯示目前 gateway 名稱
- 沒有 overlay

### 2. Pending Switch
使用者確認新 gateway 後的第一個瞬間。

可見提示：
- 在目前畫面上方出現 player overlay
- Overlay 標題：`正在切換 gateway`
- Overlay 副標：`正在保留你目前的位置並重新連線`
- 禁止重複送出同一個 Apply

行為：
- 建立目前 session 快照：
  - `previousGateway`
  - `targetGateway`
  - `resumeTime`
  - `wasPlaying`
  - `cid`

### 3. Connecting
新媒體來源已開始請求。

可見提示：
- 狀態訊息依序可顯示：
  - `正在連線到新的 gateway...`
  - `正在載入播放清單...`
  - `正在跳轉到 12:34...`
- Header 的 gateway 按鈕可顯示次級標籤：
  - `切換中...`

行為：
- 若可能，保留上一個已渲染畫面
- 暫停播放，避免音訊與畫面錯位
- 在新來源請求啟動後才真正拆除舊來源

### 4. Verifying
Metadata 已載入，播放器正在 seek 回原本位置。

可見提示：
- `正在驗證播放連續性...`
- 可選的技術細節：
  - `Pinata -> 12:34`

驗證條件：
- `loadedmetadata` 已觸發
- seek 已被要求執行
- 播放器 `currentTime()` 與目標時間落在可接受誤差範圍內
- 首幀可播放，或 `canplay` 已觸發

### 5. Success
新 gateway 已準備完成。

可見提示：
- 顯示 1.5 到 2 秒的成功 toast：
  - `已切換到 Pinata`
- 可選副標：
  - `已從 12:34 繼續播放`

行為：
- 若切換前正在播放，成功後自動續播
- 若切換前是暫停，成功後維持暫停
- 只有成功後才更新 URL

### 6. Failed
新 gateway 無法在合理時間內提供媒體。

可見提示：
- Error toast 或 banner：
  - `無法切換到 dweb.link`
- 操作按鈕：
  - `重試`
  - `保留目前 gateway`
  - `改用上一個可用 gateway`（若適用）

行為：
- 回退到最後一個已知可用的 gateway
- 還原之前的播放狀態
- 保持失敗結果為非破壞性

## 建議 UX 文案

### 切換中
- 標題：`正在切換 gateway`
- 內文：`我們正在重新連線串流，同時保留你目前的播放位置。`

### 成功
- `Gateway 已切換`
- `目前正在使用 Pinata 播放`

### 失敗
- `Gateway 切換失敗`
- `選擇的 gateway 沒有在時間內回應。`

### 重試輔助
- `再試一次`
- `改用上一個 gateway`

## 互動細節

### 保留播放意圖
在切換前記錄 `wasPlaying`。

規則：
- 若切換前正在播放，成功後自動續播。
- 若切換前是暫停，成功後維持暫停。
- 若切換失敗，恢復切換前的播放 / 暫停狀態。

### 保留視覺連續性
切換開始時，不應立刻把播放器清成黑畫面或空畫面。

建議行為：
- 以 overlay 凍結目前畫面的視覺感受
- Overlay fade in 約 120 到 180 ms
- 成功後 Overlay fade out 約 180 到 220 ms

### 尊重使用者控制
在切換期間：
- 停用重複對同一目標送出 Apply
- 只有在新請求尚未正式提交前允許 Cancel
- 一旦來源切換已開始，只有在實作可靠時才提供 `Abort`

對 v1 較安全的規則：
- 提交後不提供取消
- 逾時或失敗時自動 rollback

## 功能需求

### FR-1 Session 快照
切換前需保存：
- `cid`
- `fromGateway`
- `toGateway`
- `resumeTime`
- `wasPlaying`
- `selectedSubtitleLanguage`
- `selectedQuality`（若可恢復）

### FR-2 明確的切換狀態
`App.vue` 應擁有專門的切換 state object，而不是只依賴泛用的 `status` 字串。

建議結構：

```js
{
  phase: 'idle' | 'pending' | 'connecting' | 'verifying' | 'success' | 'failed',
  fromGateway: '',
  toGateway: '',
  resumeTime: 0,
  wasPlaying: false,
  startedAt: 0,
  error: '',
}
```

### FR-3 延後提交 URL
在切換成功前，不要先把 `window.history` 更新成新的 gateway。

原因：
- URL 應代表已經提交成功的播放狀態，而不是尚未驗證的嘗試。

### FR-4 Timeout 政策
需要定義切換 timeout。

建議預設值：
- localhost metadata timeout：4 秒
- 公開 gateway metadata timeout：8 秒
- 完整驗證 timeout 上限：10 秒

若超時：
- 將切換標記為失敗
- 回退到上一個 gateway

### FR-5 驗證閘門
只有在以下條件成立時，gateway 切換才算成功：
- 來源 metadata 已載入
- seek 已在容許誤差內完成
- 播放器已能從目標來源渲染或播放

建議誤差：
- VOD 以目標續播時間前後 2 秒內為可接受範圍

### FR-6 Header 回饋
Header 上的 gateway 按鈕應反映切換狀態。

狀態：
- 一般：`Gateway`
- 切換中：`切換中...`
- 失敗：顯示一個淡化的警示點，直到使用者關閉或重新操作

### FR-7 狀態顯示區
在播放器附近建立結構化的狀態區，不要只用低價值的 debug 文案。

需支援：
- 載入標題
- 短描述
- 可選的操作按鈕

### FR-8 失敗恢復
切換失敗時，至少提供：
- 重試同一 gateway
- 回退到上一個 gateway
- 改選其他 gateway

### FR-9 字幕策略
字幕偵測不應阻擋切換完成。

規則：
- 媒體連續性優先
- 字幕探測為次要，可在播放就緒後繼續進行

### FR-10 畫質恢復
若前一個畫質等級可以映射到新 gateway，則在驗證後恢復；若不行，則退回 auto quality，但不能因此阻擋切換完成。

## 技術設計說明

### 目前瓶頸
依目前程式碼來看：

1. `App.vue` 內的 `onGatewayChange()` 會立刻呼叫 `loadVideo(...)`
2. `loadVideo()` 會立刻更新 state 與 URL
3. `VideoPlayer.vue` 目前只提供泛用的狀態更新，沒有明確的切換生命週期事件
4. 播放器回傳給 `App.vue` 的成功 / 失敗握手機制仍不完整

### 需要的事件契約
`VideoPlayer.vue` 應在 gateway 切換過程中發出結構化事件。

建議事件：
- `switch-start`
- `switch-metadata-loaded`
- `switch-seeked`
- `switch-ready`
- `switch-failed`

範例 payload：

```js
{
  gateway: 'https://gateway.pinata.cloud/ipfs/',
  cid: 'bafy...',
  resumeTime: 754,
  elapsedMs: 1320,
  reason: '',
}
```

### 建議控制流程

1. `Header.vue`
   送出 `gateway-change`，帶入使用者選擇的 gateway。

2. `App.vue`
   建立播放快照，並將切換 phase 設為 `pending`。

3. `App.vue`
   要求 `VideoPlayer.vue` 依切換 metadata 切換來源。

4. `VideoPlayer.vue`
   載入目標來源，並持續發出生命週期事件。

5. `App.vue`
   只有在收到 `switch-ready` 後才提交 gateway state 與 URL。

6. `App.vue`
   若收到 `switch-failed`，則執行 rollback。

## 建議 UI 新增項目

### Player Overlay
可新增獨立元件，或先在 `VideoPlayer.vue` 內做 inline block。

內容：
- spinner 或線性進度條
- 狀態標題
- 短訊息
- 來源 gateway 與目標 gateway

範例：

```text
正在切換 gateway
Local Node -> Pinata
正在保留你在 12:34 的位置
```

### 成功 Toast
位置：
- Desktop 放在播放器右上角
- Mobile 放在上中或底部 sheet 形式

時間：
- 建議 1600 ms

### 失敗 Banner
位置：
- 可放在播放器控制列上方，或 header 下方

操作：
- 重試
- 回退

## 無障礙需求

1. 切換狀態需透過 `aria-live="polite"` 宣告。
2. 若切換失敗導致播放中止，錯誤訊息與恢復操作應使用 `aria-live="assertive"`。
3. 關閉 Gateway Settings 後，鍵盤焦點必須可預期地回到合理位置。
4. 切換期間被停用的按鈕，需同時具有可見與語意上的 disabled 狀態。

## 分析與除錯

至少追蹤：
- 切換開始時間
- 來源 gateway
- 目標 gateway
- 切換耗時
- 成功 / 失敗結果
- 失敗原因分類：
  - timeout
  - manifest load error
  - segment load error
  - seek verification mismatch

第一版可以先用 console log 作為開發期追蹤。

## 驗收標準

### AC-1 順暢度
當同一個 CID 切換 gateway 時，使用者不應看到超過 300 ms 且無法解釋的空白播放器狀態。

### AC-2 連續性
若切換成功，播放應回到原本時間附近，誤差不超過 2 秒。

### AC-3 URL 可信度
若切換失敗，URL 應維持在最後一個已知可用的 gateway。

### AC-4 失敗恢復
若選定的 gateway 失敗，系統必須明確告知使用者，並提供恢復操作。

### AC-5 字幕非阻塞
字幕偵測不可阻擋播放變成 ready。

### AC-6 暫停狀態保留
若使用者切換前是暫停，成功後仍須維持暫停。

## 實作規劃

### Phase 1
- 在 `App.vue` 引入 gateway transition state
- 將 URL 提交延後到切換成功後
- 加入 player overlay 狀態
- 讓 `VideoPlayer.vue` 發出成功 / 失敗事件
- 補上 timeout 與 rollback

### Phase 2
- 保留字幕語言與畫質偏好
- 在 dialog 中加入 gateway 效能提示
- 補上 retry 與替代 gateway 建議

### Phase 3
- 評估在 source swap 前做輕量 preflight 檢查
- 評估建立 last-known gateway health scoring

## 開放問題

1. 若瀏覽器 autoplay policy 擋住自動續播，是否仍要在成功後嘗試播放？
   建議：
   先嘗試 resume，若失敗再退回明確的 `點擊繼續播放` 提示。

2. 是否要在真正切換來源前，先對新 gateway 的 `index.m3u8` 做 preflight？
   建議：
   若實作成本可接受，對公開 gateway 應採用。

3. Gateway Settings 是否需要顯示 latency 預估？
   建議：
   v1 不必，但 phase 2 值得加入。

## 立即工程建議
最重要的修正其實是架構層面的：

將 gateway 切換從單純的 prop 更新，提升為明確的交易式流程：
- 先建立目前 session 快照
- 開始切換
- 驗證目標 gateway
- 成功後提交
- 失敗時回滾

如果沒有做到這一步，即使後續補了 loading 文案或動畫，播放器的切換感受仍然會偏突兀。
