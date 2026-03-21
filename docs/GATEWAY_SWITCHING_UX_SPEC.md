# Gateway 切換 UX 規格書

## 文件狀態

- 狀態：已依目前實作更新
- 性質：現況規格與已知限制記錄
- 主要影響介面：`src/App.vue`、`src/components/Header.vue`、`src/components/VideoPlayer.vue`

## 1. 目前行為摘要

目前的 gateway 切換屬於「立即套用並重新載入來源」模型，而不是交易式切換流程。

使用者在 `Header.vue` 的 Gateway Settings 視窗中選擇目標 gateway 並按下 `Apply` 後：

1. Dialog 立即關閉
2. `Header.vue` 發出 `gateway-change`
3. `App.vue` 立即將新 gateway 視為目前值，並寫入 `localStorage`
4. 若目前已有 CID，`App.vue` 先抓取目前播放快照，再直接呼叫 `loadVideo(...)`
5. `VideoPlayer.vue` 重設 player、重新載入 `index.m3u8`、重掛字幕、在 `loadedmetadata` 後 seek 回原本時間

目前沒有額外的 player overlay、成功 toast、失敗 banner 或 rollback。

## 2. 使用者流程

### 2.1 有 CID 時的切換流程

1. 使用者開啟 Gateway Settings
2. 使用者選擇內建 gateway、自訂 HTTPS gateway，或開發模式下的 Local Node
3. 使用者點擊 `Apply`
4. `App.vue` 透過 `getPlaybackSnapshot(window)` 記錄：
   - `time`
   - `isPlaying`
5. `App.vue` 立即：
   - 更新 `currentGateway`
   - `persistGateway(nextGateway, window)`
   - 設定新的 `currentM3u8Url`、`currentIpfsBaseUrl`、`currentPosterUrl`
   - 以原播放時間作為 `startTime`
   - 以原播放 / 暫停狀態作為 `shouldAutoplay`
6. `VideoPlayer.vue` 顯示泛用狀態文字並重新載入來源

### 2.2 無 CID 時的切換流程

若目前沒有 CID：

- gateway 仍會立即寫入 `localStorage`
- 不會觸發播放器重新載入
- 後續搜尋 CID 時，會使用最後一次選定的 gateway

## 3. 目前可見回饋

### 3.1 Header

Header 右上角的 gateway 按鈕固定顯示：

- 主標：`Gateway`
- 次標：目前 gateway 名稱
- 一個狀態燈號，反映背景 probe 結果

目前不會顯示：

- `切換中...`
- 切換專用次級文案
- 切換失敗警示點

### 3.2 Player 區域

播放器切換來源時，使用的是 `VideoPlayer.vue` 既有狀態文字，而不是結構化的 gateway switch UX。

目前實際會出現的文字包含：

- `正在載入影片...`
- `播放器已就緒`
- `播放器已就緒，繼續播放中`
- `✅ 資源就緒！請手動播放 (將從 mm:ss 開始)。`
- `播放器已就緒，請手動播放`

目前沒有：

- `正在切換 gateway` overlay
- `Local Node -> dweb.link` 之類的切換路徑提示
- 成功 toast
- 失敗重試按鈕

## 4. 狀態與資料責任

### 4.1 URL

分享 URL 只同步：

- `cid`
- `t`

`App.vue` 會主動把 `gateway` 從 query string 中移除，不將 gateway 寫入分享 URL。

### 4.2 Storage

gateway 屬於瀏覽器偏好設定，使用 `localStorage` 持久化。

目前寫入時機為：

- `onGatewayChange()` 一開始就寫入一次
- `loadVideo()` 內又會再寫入一次

也就是說，新 gateway 在載入成功前就已被視為已提交狀態。

### 4.3 Sidecar 與字幕

切換 gateway 後，`App.vue` 會重新推導同一個 CID 的 sidecar 路徑：

- `index.m3u8`
- `cover.webp`
- `info.json`
- `subtitles.json`
- `avatar.jpg`

字幕與 metadata 會平行載入，但目前 UI 不會把「媒體切換」與「字幕 / metadata 載入」拆成獨立階段顯示。

## 5. 續播行為

目前續播邏輯如下：

- 切換前抓取整秒 `time`
- 切換前抓取 `isPlaying`
- `VideoPlayer.vue` 在 `loadedmetadata` 後直接 `player.currentTime(startTime)`
- 若切換前正在播放，則在 `canplay` 後嘗試 `player.play()`
- 若自動播放被瀏覽器阻擋，退回「請手動播放」訊息

目前沒有額外驗證：

- seek 是否落在容許誤差內
- 第一個片段是否已真的從新 gateway 成功播放
- 播放器是否需要回退到舊 gateway

## 6. 目前限制

以下功能目前尚未實作：

- 專門的 gateway transition state object
- `pending / connecting / verifying / success / failed` phase
- `switch-start`、`switch-ready`、`switch-failed` 等結構化事件
- 切換 timeout 與 App 層 rollback
- 切換失敗後的 `重試 / 回退 / 改選其他 gateway` 操作
- 切換期間的 `aria-live` 宣告
- 專屬 overlay / toast / banner
- 字幕語言與畫質偏好在切換成功後的顯式恢復驗證

## 7. 開發模式與可選 gateway

目前 gateway 選擇器的行為如下：

- 內建公開 gateway：`dweb.link`、`ipfs.io`
- 自訂 gateway：只接受公開 `HTTPS` 且以 `/ipfs/` 結尾的 URL
- Local Node：只在 `import.meta.env.DEV` 為 `true` 時顯示
- 已停用 gateway：`gateway.pinata.cloud`

## 8. 驗收條件

符合以下條件時，可視為目前實作與本文一致：

1. 使用者按下 `Apply` 後，Dialog 立即關閉，且沒有專屬切換 overlay。
2. `gateway` 不會出現在分享 URL 中，只會寫進 `localStorage`。
3. 若目前有 CID，切換時會保留整秒播放時間與播放 / 暫停意圖。
4. 播放器以泛用狀態文字回饋來源切換，而不是 gateway 專屬狀態機。
5. 切換失敗時，系統不提供 App 層 rollback 或 retry UI；使用者需再次手動切換。
