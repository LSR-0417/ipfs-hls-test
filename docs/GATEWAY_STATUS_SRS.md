# Gateway 狀態指示需求規格書 (SRS)

## 1. 目的
本文件定義 IPFS Gateway 狀態指示功能的需求，讓使用者在切換 gateway 前，可以先知道目前影片的播放清單 `index.m3u8` 與實際媒體片段是否可由各 gateway 正常取得。

本規格聚焦於使用者提出的核心需求：
- 若成功快速驗證 `index.m3u8` 與抽樣媒體片段，對應 gateway 顯示綠燈
- 若已取得 `index.m3u8`，但片段仍在驗證中或驗證速度偏慢，對應 gateway 顯示黃燈
- 若已取得 `index.m3u8`，但 media playlist / segment 驗證失敗，對應 gateway 顯示橘燈
- 若超時或找不到播放清單，對應 gateway 顯示紅燈

## 2. 範圍
- 作用範圍：Gateway Settings 視窗中的所有可選 gateway
- 檢查目標：`${gatewayBaseUrl}${cid}/index.m3u8`，以及由播放清單推導出的 media playlist / segment URL
- 依據資料：目前播放器中正在瀏覽或準備播放的 CID

不包含：
- 自動切換到最佳 gateway
- 背景持續健康監控

## 3. 名詞定義
- `gateway`: 提供 IPFS HTTP 路徑式存取能力的入口 URL，例如 `https://dweb.link/ipfs/`
- `CID`: 當前欲播放的 IPFS 內容識別碼
- `index.m3u8`: 影片播放主清單，作為 gateway 可用性驗證入口

## 4. 使用者故事
1. 作為播放器使用者，我希望在切換 gateway 前看到每個 gateway 是否能取到 `index.m3u8` 與部分媒體片段，以降低盲目切換的風險。
2. 作為播放器使用者，我希望當 gateway 尚未檢查完成時，介面明確告知系統仍在搜尋中。
3. 作為播放器使用者，我希望當 gateway 已超時或找不到播放清單時，介面能快速顯示失敗狀態。

## 5. 功能需求

### FR-1 狀態檢查觸發
當目前 CID 被載入或切換時，系統應開始檢查每個可顯示 gateway 的 `index.m3u8`、必要的 media playlist 與抽樣媒體片段可達性，而不是等待使用者開啟 Gateway Settings 視窗。

### FR-1.1 背景定期刷新
當目前已有 CID 時，系統應定期重新檢查 gateway 狀態，讓使用者在稍後打開 Gateway Settings 時，能立即看到接近即時的結果。預設背景輪詢週期為 3 分鐘。

### FR-2 綠燈條件
當某個 gateway 成功取得 `index.m3u8`，並在可接受時間內完成抽樣媒體片段驗證時，該 gateway 應顯示綠燈。

### FR-3 黃燈條件
當某個 gateway 已成功取得 `index.m3u8`，但抽樣媒體片段仍在驗證中，或雖可取得但未達快速可播門檻時，該 gateway 應顯示黃燈。

### FR-4 橘燈條件
當某個 gateway 已成功取得 `index.m3u8`，但 media playlist 或抽樣媒體片段驗證失敗時，該 gateway 應顯示橘燈。

### FR-4.1 紅燈條件
當某個 gateway 在預設 timeout 內未能取得 `index.m3u8`，或播放清單請求結果為失敗時，該 gateway 應顯示紅燈。

### FR-4.2 限流冷卻
當某個 gateway 回傳 `429 Too Many Requests` 時，系統應將該 gateway 標記為限流，而不是一般失敗，並在冷卻期間暫停對該 gateway 的背景檢查。

### FR-4.3 失敗原因分類
系統應區分常見 HTTP 狀態，不應將所有非成功回應都視為「被 ban」：
- `429`: 限流
- `504`: 上游逾時
- `301/302/307/308`: 重新導向

### FR-5 多 gateway 並列顯示
系統應能在同一個 Gateway Settings 視窗中，同時顯示多個 gateway 的檢查狀態。

### FR-6 與 CID 連動
當目前 CID 改變時，系統應重新檢查 gateway 狀態，避免沿用上一支影片的結果。

### FR-7 自訂 gateway 支援
若使用者輸入自訂 gateway，系統應在該 gateway URL 合法時納入檢查與燈號顯示。

### FR-8 無 CID 狀態
若目前沒有 CID，系統不應執行播放清單 / 媒體片段檢查，但仍應保留中性狀態提示。

## 6. 非功能需求

### NFR-1 易讀性
燈號顏色應在深色主題下清楚可辨，並應搭配文字狀態，避免只靠顏色傳遞資訊。文字應優先描述「能不能順播」與「順不順」，而不是直接暴露技術延遲數字。

### NFR-2 響應速度
檢查應在使用者開啟視窗後短時間內開始，避免長時間停留在未知狀態。

### NFR-3 非阻塞
gateway 狀態檢查不應阻塞視窗操作，也不應中斷既有播放流程。

### NFR-4 一致性
相同 gateway 與相同 CID 的檢查結果，應在同一輪檢查內保持一致，不應混入舊請求結果。

## 7. 驗收條件
1. 開啟 Gateway Settings 且有 CID 時，所有候選 gateway 會先進入檢查中狀態，再依結果轉成黃燈、綠燈、橘燈或紅燈。
1.1 載入 CID 後，即使尚未開啟 Gateway Settings，系統也會在背景更新 gateway 狀態。
2. 成功驗證 `index.m3u8` 與抽樣媒體片段的 gateway 顯示綠燈。
3. 只取得 `index.m3u8` 或片段偏慢時顯示黃燈。
4. 已取得 `index.m3u8`，但 media playlist / segment 失敗時顯示橘燈。
5. 超時、404、網路失敗等播放清單層級問題顯示紅燈。
6. 無 CID 時不發送檢查請求，顯示中性提示。
7. 自訂合法 HTTPS gateway 會被檢查並顯示對應燈號。
