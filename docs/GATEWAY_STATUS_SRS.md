# Gateway 狀態指示需求規格書 (SRS)

## 1. 目的

本文件以目前實作為準，定義 Gateway Settings 中的 gateway 狀態指示功能，讓使用者在切換前可以先知道目前影片的 `index.m3u8`、media playlist 與抽樣片段是否可由各 gateway 取得。

目前實作中的狀態核心如下：

- `idle`：中性 / 灰燈
- `probing`：檢查中 / 黃燈
- `playlist_ready`：已找到 `index.m3u8`，但仍在驗證或偏慢 / 黃燈
- `ready`：已快速驗證可播 / 綠燈
- `degraded`：已找到 `index.m3u8`，但子播放清單或片段不可用 / 橘燈
- `rate_limited`：gateway 限流冷卻中 / 橘燈
- `redirected`：gateway 回傳重新導向 / 藍燈
- `failed`：播放清單層級失敗 / 紅燈

## 2. 範圍

- 作用範圍：`Header.vue` 的 Gateway Settings 視窗與 Header 按鈕狀態點
- 檢查目標：`${gatewayBaseUrl}${cid}/index.m3u8`，以及播放清單內推導出的 media playlist / segment URL
- 依據資料：目前播放器中的 `currentCid`

不包含：

- 自動切換到最佳 gateway
- 長期健康分數累積
- App 層的 gateway rollback

## 3. 使用者故事

1. 作為播放器使用者，我希望在切換 gateway 前看到每個 gateway 是否大致可順播。
2. 作為播放器使用者，我希望在稍後打開 Gateway Settings 時，能直接看到最近一次的背景檢查結果。
3. 作為播放器使用者，我希望限流、重新導向與失敗能被區分，而不是全部都顯示成同一種錯誤。

## 4. 功能需求

### FR-1 狀態檢查觸發

當目前 CID 被載入或重新載入時，系統應開始檢查每個可顯示 gateway 的：

- `index.m3u8`
- 必要的 media playlist
- 抽樣媒體片段

### FR-1.1 背景定期刷新

當目前已有 CID 時，系統應以固定週期重新檢查 gateway 狀態。預設背景輪詢週期為 `3` 分鐘。

### FR-2 `ready` 條件

當某個 gateway 成功取得 `index.m3u8`，並在可接受時間內完成抽樣片段驗證時，該 gateway 應標記為：

- `ready`
- 綠燈

### FR-3 `playlist_ready` 條件

當某個 gateway 已成功取得 `index.m3u8`，但仍符合以下任一條件時，該 gateway 應標記為：

- `playlist_ready`
- 黃燈

條件：

- 片段仍在驗證中
- 前幾個片段可取得，但整體驗證時間超過快速可播門檻

### FR-4 `degraded` 條件

當某個 gateway 已成功取得 `index.m3u8`，但 media playlist 或抽樣片段驗證失敗時，該 gateway 應標記為：

- `degraded`
- 橘燈

### FR-4.1 `failed` 條件

當某個 gateway 在播放清單層級失敗，例如：

- timeout
- `404`
- 網路錯誤
- 無法取得 `index.m3u8`

則應標記為：

- `failed`
- 紅燈

### FR-4.2 `rate_limited` 條件

當某個 gateway 回傳 `429 Too Many Requests` 時，系統應：

- 將其標記為 `rate_limited`
- 顯示限流冷卻中的文字
- 在冷卻期間暫停背景檢查

### FR-4.3 `redirected` 條件

當某個 gateway 回傳 `301`、`302`、`307`、`308` 時，系統應：

- 將其標記為 `redirected`
- 以獨立於一般失敗的狀態呈現

### FR-5 多 gateway 並列顯示

系統應能在同一個 Gateway Settings 視窗中，同時顯示多個 gateway 的狀態。

### FR-6 與 CID 連動

當目前 CID 改變時，系統應重新檢查 gateway 狀態，避免沿用上一支影片的結果。

### FR-7 自訂與本地 gateway 支援

目前實作支援：

- 自訂公開 `HTTPS` gateway
- 開發模式下的 Local Node gateway

自訂 gateway 只有在 URL 合法時才會納入檢查。

### FR-8 無 CID 狀態

若目前沒有 CID，系統不應發送播放清單 / 片段檢查請求，但仍應保留中性狀態提示。

### FR-9 推薦與排序

目前實作中：

- `ready` gateway 依 `durationMs` 由小到大排序
- 延遲最短的 `ready` gateway 會顯示 `Recommended`
- 其他狀態的排序優先序為：
  1. `ready`
  2. `playlist_ready`
  3. `probing`
  4. `degraded`
  5. `idle`
  6. `redirected`
  7. `rate_limited`
  8. `failed`

## 5. 非功能需求

### NFR-1 易讀性

燈號顏色應在深色主題下清楚可辨，並搭配文字狀態。文字應優先描述「能不能順播」與「順不順」，而不是直接暴露原始技術數值。

### NFR-2 響應速度

CID 載入後，狀態檢查應快速開始；使用者開啟視窗時，應能直接看到最近一輪背景結果。

### NFR-3 非阻塞

gateway 狀態檢查不應阻塞視窗操作，也不應中斷既有播放流程。

### NFR-4 一致性

相同 gateway 與相同 CID 的檢查結果，應在同一輪檢查內保持一致，不應混入過期請求結果。

## 6. 驗收條件

1. 載入 CID 後，即使尚未開啟 Gateway Settings，系統也會在背景更新 gateway 狀態。
2. 開啟 Gateway Settings 時，候選 gateway 會顯示最近一次背景檢查結果。
3. 快速驗證 `index.m3u8` 與抽樣片段成功的 gateway 顯示綠燈。
4. 只取得 `index.m3u8` 或片段偏慢時顯示黃燈。
5. 已取得 `index.m3u8`，但 media playlist / segment 驗證失敗時顯示橘燈。
6. `429` 顯示為限流冷卻狀態，而不是一般失敗。
7. `301/302/307/308` 以重新導向狀態獨立呈現。
8. 無 CID 時不發送檢查請求，顯示中性提示。
9. 自訂合法 HTTPS gateway 會被檢查並顯示對應燈號。
