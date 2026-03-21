# Gateway 狀態指示設計說明書 (SDDD)

## 1. 設計目標

本文件以目前實作為準，說明 Gateway Settings 中 gateway 狀態探測與排序的實際設計。

目前設計的核心方向為：

- 以燈號快速表達可用性
- 以簡短文字表達「能不能順播」
- 用內部量測的 `durationMs` 做排序與推薦
- 將結果與目前 CID 綁定

目前 UI 不直接顯示原始毫秒數。

## 2. 狀態模型

### 2.1 Probe State

每個 gateway 在 UI 上對應一個 probe state：

```js
{
  state: 'idle' | 'probing' | 'playlist_ready' | 'ready' | 'degraded' | 'rate_limited' | 'redirected' | 'failed',
  detail: '',
  durationMs: null,
  httpStatus: null,
  retryAfterMs: null,
  nextProbeAt: null,
}
```

### 2.2 視覺對應

- `idle`：灰燈
- `probing`：黃燈，帶 pulse 動畫
- `playlist_ready`：黃燈
- `ready`：綠燈
- `degraded`：橘燈
- `rate_limited`：橘燈
- `redirected`：藍燈
- `failed`：紅燈

### 2.3 目前顯示文字

`Header.vue` 透過 `formatGatewayPlaybackText()` 將 probe state 轉成較口語的文案：

- `idle`：沿用 `detail`，通常為 `載入 CID 後可檢查` 或 `輸入 HTTPS gateway 後可檢查`
- `probing`：`正在判斷順播度`
- `playlist_ready`：
  - `已連上，正在確認順播`
  - 或 `能播，但偏慢`
- `ready`：
  - `順播穩定`
  - 或 `可順播`
- `degraded`：`可連上，但容易卡頓`
- `rate_limited`：`暫時無法判斷`
- `redirected`：`路徑不穩，結果未定`
- `failed`：`大概率無法順播`

冷卻時間的細節會保存在 `detail` 中，例如 `限流中 · 約 N 分後重試`，但主狀態文案仍以較抽象的可播性描述為主。

## 3. 互動設計

### 3.1 背景探測

當 CID 被載入後：

1. `Header.vue` 立刻重設 probe state
2. 排程執行第一輪 probe
3. 之後以 `180000 ms` 為週期持續刷新

當 Gateway Settings 開啟時：

- 直接顯示最近一次背景 probe 的結果
- 若手動按下 `Recheck Now`，立即啟動新一輪 probe

### 3.2 候選清單

目前候選 gateway 來源如下：

- 內建公開 gateway：`dweb.link`、`ipfs.io`
- 開發模式下的 `Local Node`
- 使用者輸入的自訂公開 `HTTPS` gateway

### 3.3 自訂 gateway

自訂 gateway 的規則如下：

- 必須是公開 `HTTPS` URL
- 必須正規化為 `/ipfs/` base URL
- 非法 URL 不進入 probe
- 自訂 gateway 固定顯示在獨立輸入區塊，不和內建列表混排

### 3.4 推薦策略

在本輪 probe 中：

- 只有 `ready` gateway 會被考慮為 `Recommended`
- 若有多個 `ready` gateway，選 `durationMs` 最短者
- 若只有一個 `ready` gateway，也會顯示 `Recommended`

### 3.5 排序策略

目前排序優先序為：

1. `ready`
2. `playlist_ready`
3. `probing`
4. `degraded`
5. `idle`
6. `redirected`
7. `rate_limited`
8. `failed`

同為 `ready` 時，依 `durationMs` 由小到大排序；其他同級保留原始順序。

## 4. 資料流設計

### 4.1 上游資料

`App.vue` 提供：

- `currentGateway`
- `currentCid`
- `currentLoadSequence`

`Header.vue` 依此決定何時重跑 probe，並將結果保存在自身 UI state。

### 4.2 Probe 流程

1. `Header.vue` 收到 `currentCid`
2. 建立候選 gateway 清單
3. 對每個候選 gateway 呼叫 `probeGatewayAvailability()`
4. 先檢查 `${gateway}${cid}/index.m3u8`
5. 若需要，再讀 variant playlist 與抽樣片段
6. 依結果回傳 `ready`、`playlist_ready`、`degraded`、`rate_limited`、`redirected` 或 `failed`
7. UI 更新燈號、文字、推薦與排序

### 4.3 過期結果保護

目前使用 `gatewayProbeSeq` 丟棄過期結果，避免：

- CID 變更後舊 probe 覆蓋新結果
- 背景 probe 與手動 probe 互相覆蓋
- 已卸載元件後的晚到結果污染 UI

### 4.4 限流冷卻

當 probe 結果為 `rate_limited` 時：

- 會依 `Retry-After` 或預設 backoff 計算 `nextProbeAt`
- 冷卻期間略過該 gateway 的 probe
- UI 保留限流狀態，直到冷卻結束或新結果覆蓋

## 5. 技術選型

- Probe utility：`src/utils/gateway.js`
- UI state 與排序：`src/components/Header.vue`
- 文字文案：`src/utils/gatewayStatus.js`
- timeout：`fetch` + `AbortController`
- 延遲量測：以可注入的 `nowFn()` 計算，預設等同 `performance.now()` 類型邏輯

## 6. 實作決策

### 6.1 為何檢查 `index.m3u8`

因為播放器實際播放入口就是 `index.m3u8`，以它作為第一層健康檢查比單純檢查 gateway root 更貼近真實播放路徑。

### 6.2 為何 UI 不直接顯示毫秒

目前產品文案優先表達「順不順」，而不是直接把技術延遲數字暴露給使用者；`durationMs` 仍會被保留作為排序與推薦依據。

### 6.3 為何 `429` 要進冷卻

限流中的 gateway 若持續被背景 probe 打到，只會讓封鎖更持久，因此目前實作會暫停該 gateway 的背景檢查一段時間。

## 7. 目前實作範圍

已實作：

- 背景 probe 與 3 分鐘輪詢
- 紅 / 黃 / 綠 / 灰 / 橘 / 藍燈號
- `429` 冷卻與重新導向分類
- `Recommended` 標記
- 依 probe 結果排序
- 手動 `Recheck Now`

未實作：

- UI 直接顯示 `{durationMs} ms`
- 自動切換到推薦 gateway
- 長期健康分數與歷史統計
- App 層 gateway rollback
