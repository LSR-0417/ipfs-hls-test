# Gateway 狀態指示設計說明書 (SDDD)

## 1. 設計目標
本文件整合使用者提出的紅黃綠燈需求，並補上較完整的互動與狀態設計，讓 Gateway Settings 不只是「會亮燈」，而是能幫助使用者更快做出切換決策。

本設計的核心方向：
- 保留直觀的紅黃綠燈
- 補上文字狀態，避免只有顏色
- 對可用 gateway 顯示延遲時間，提升可比較性
- 對最快的可用 gateway 顯示推薦標記
- 將檢查結果與目前 CID 綁定，避免誤導

## 2. 設計原則

### 2.1 燈號只是入口，不是全部資訊
燈號能快速傳達可用性，但不足以支援選擇。實際切 gateway 時，使用者還需要知道：
- 系統是否仍在檢查
- 檢查結果是成功還是失敗
- 成功的 gateway 之間，誰比較快

### 2.2 檢查依據應明確且可重現
本功能不猜測 gateway 是否可用，而是直接檢查：

```text
${gatewayBaseUrl}${cid}/index.m3u8
```

這與實際播放鏈路一致，因此結果對切換決策有參考價值。

### 2.3 結果只能屬於當前這一輪檢查
當 CID、gateway 輸入值或視窗開關狀態改變時，舊請求結果應被丟棄，避免 UI 混入過期資料。

## 3. 狀態模型

### 3.1 Probe State
每個 gateway 在 UI 上對應一個 probe state：

```js
{
  state: 'idle' | 'probing' | 'ready' | 'failed',
  detail: '',
  durationMs: null,
}
```

### 3.2 視覺對應
- `idle`: 灰燈，表示尚未檢查或目前沒有 CID
- `probing`: 黃燈，帶 pulse 動畫，表示正在尋找 `index.m3u8`
- `ready`: 綠燈，表示已找到 `index.m3u8`
- `failed`: 紅燈，表示 timeout 或 HTTP / 網路失敗

### 3.3 狀態文字
- `idle`: `載入 CID 後可檢查` 或 `輸入 HTTPS gateway 後可檢查`
- `probing`: `檢查中`
- `ready`: `可用 · {durationMs} ms`
- `failed`: `逾時`、`HTTP 404`、`無法取得 index.m3u8`

## 4. 互動設計

### 4.1 視窗開啟時的行為
當 Gateway Settings 開啟時：
1. 若沒有 CID，只顯示中性狀態
2. 若有 CID，對所有候選 gateway 啟動 probe
3. probe 結果回來後更新燈號、狀態文案與延遲

### 4.2 自訂 gateway
- 自訂 gateway 在 URL 合法時納入檢查
- 非法 URL 不進入 probe 流程
- 自訂 gateway 仍顯示於固定輸入區塊，不和預設 gateway 混排

### 4.3 推薦策略
在本輪 probe 中：
- 若有多個 `ready` gateway，延遲最短者顯示 `Recommended`
- 若只有一個 `ready` gateway，也可顯示 `Recommended`
- `failed` gateway 不顯示推薦

### 4.4 排序策略
預設 gateway 清單在有 probe 結果時，依下列優先順序排序：
1. `ready`
2. `probing`
3. `idle`
4. `failed`

同為 `ready` 時，依 `durationMs` 由小到大排序；其他同級則保留原始順序。

## 5. 資料流設計

### 5.1 上游資料
`App.vue` 提供：
- `currentGateway`
- `currentCid`

`Header.vue` 依此決定要 probe 哪些 gateway，並將結果只保存在自身的 UI state。

### 5.2 Probe 流程
1. `Header.vue` 收到 `currentCid`
2. 開啟 Gateway Settings
3. 建立候選清單
4. 對每個候選 gateway 呼叫共用 probe utility
5. probe utility 檢查 `${gateway}${cid}/index.m3u8`
6. 成功回傳 `ready + durationMs`
7. 失敗回傳 `failed + detail`
8. UI 更新燈號、文案、推薦標記與排序

### 5.3 過期結果保護
使用 sequence token 或等效機制丟棄舊結果，避免：
- 視窗已關閉但請求晚回來
- CID 改變後舊影片的 probe 結果覆蓋新影片
- 自訂 gateway 輸入途中出現錯置狀態

## 6. 技術選型
- Probe utility 放在 `src/utils/gateway.js`
- UI probe state 放在 `src/components/Header.vue`
- 以 `fetch` + `AbortController` 實作 timeout
- 以 `performance.now()` 或等效 clock 測量延遲

## 7. 實作決策

### 7.1 為何檢查 `index.m3u8`
因為播放器實際載入入口就是 `index.m3u8`，以它作為第一層健康檢查比單純 ping gateway root 更貼近真實播放成功率。

### 7.2 為何不在 v1 阻擋紅燈切換
紅燈代表本輪檢查失敗，但仍可能是暫時性網路波動或 CORS 差異。v1 應保留使用者手動切換能力，只提供明確警示，不做硬阻擋。

### 7.3 為何保留文字說明
色弱使用者、低亮度環境或行動裝置縮小版面下，單靠顏色不足。文字說明可補足辨識與信心。

## 8. 本次實作範圍
- 實作紅黃綠灰燈號
- 實作 probe timeout 與失敗文案
- 實作成功延遲顯示
- 實作推薦標記
- 實作依 probe 結果排序預設 gateway

不在本次實作：
- 自動切換到推薦 gateway
- 長期健康分數累積
- 背景定時持續刷新
