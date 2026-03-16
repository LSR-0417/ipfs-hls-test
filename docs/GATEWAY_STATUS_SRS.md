# Gateway 狀態指示需求規格書 (SRS)

## 1. 目的
本文件定義 IPFS Gateway 狀態指示功能的需求，讓使用者在切換 gateway 前，可以先知道目前影片的播放清單 `index.m3u8` 是否可由各 gateway 正常取得。

本規格聚焦於使用者提出的核心需求：
- 若有抓到 `index.m3u8`，對應 gateway 顯示綠燈
- 若系統仍在搜尋 `index.m3u8`，對應 gateway 顯示黃燈
- 若超時或找不到 `index.m3u8`，對應 gateway 顯示紅燈

## 2. 範圍
- 作用範圍：Gateway Settings 視窗中的所有可選 gateway
- 檢查目標：`${gatewayBaseUrl}${cid}/index.m3u8`
- 依據資料：目前播放器中正在瀏覽或準備播放的 CID

不包含：
- 自動切換到最佳 gateway
- 背景持續健康監控
- segment 級別的可用性驗證

## 3. 名詞定義
- `gateway`: 提供 IPFS HTTP 路徑式存取能力的入口 URL，例如 `https://dweb.link/ipfs/`
- `CID`: 當前欲播放的 IPFS 內容識別碼
- `index.m3u8`: 影片播放主清單，作為 gateway 是否可用的第一層驗證目標

## 4. 使用者故事
1. 作為播放器使用者，我希望在切換 gateway 前看到每個 gateway 是否能取到 `index.m3u8`，以降低盲目切換的風險。
2. 作為播放器使用者，我希望當 gateway 尚未檢查完成時，介面明確告知系統仍在搜尋中。
3. 作為播放器使用者，我希望當 gateway 已超時或找不到播放清單時，介面能快速顯示失敗狀態。

## 5. 功能需求

### FR-1 狀態檢查觸發
當使用者開啟 Gateway Settings 視窗，且目前已有 CID 時，系統應開始檢查每個可顯示 gateway 的 `index.m3u8` 可達性。

### FR-2 綠燈條件
當某個 gateway 成功取得 `index.m3u8` 時，該 gateway 應顯示綠燈。

### FR-3 黃燈條件
當某個 gateway 的 `index.m3u8` 檢查請求已發出，但結果尚未完成時，該 gateway 應顯示黃燈。

### FR-4 紅燈條件
當某個 gateway 在預設 timeout 內未能取得 `index.m3u8`，或請求結果為失敗時，該 gateway 應顯示紅燈。

### FR-5 多 gateway 並列顯示
系統應能在同一個 Gateway Settings 視窗中，同時顯示多個 gateway 的檢查狀態。

### FR-6 與 CID 連動
當目前 CID 改變時，系統應重新檢查 gateway 狀態，避免沿用上一支影片的結果。

### FR-7 自訂 gateway 支援
若使用者輸入自訂 gateway，系統應在該 gateway URL 合法時納入檢查與燈號顯示。

### FR-8 無 CID 狀態
若目前沒有 CID，系統不應執行 `index.m3u8` 檢查，但仍應保留中性狀態提示。

## 6. 非功能需求

### NFR-1 易讀性
燈號顏色應在深色主題下清楚可辨，並應搭配文字狀態，避免只靠顏色傳遞資訊。

### NFR-2 響應速度
檢查應在使用者開啟視窗後短時間內開始，避免長時間停留在未知狀態。

### NFR-3 非阻塞
gateway 狀態檢查不應阻塞視窗操作，也不應中斷既有播放流程。

### NFR-4 一致性
相同 gateway 與相同 CID 的檢查結果，應在同一輪檢查內保持一致，不應混入舊請求結果。

## 7. 驗收條件
1. 開啟 Gateway Settings 且有 CID 時，所有候選 gateway 會先進入黃燈，再依結果轉成綠燈或紅燈。
2. 成功取得 `index.m3u8` 的 gateway 顯示綠燈。
3. 超時、404、網路失敗等情況顯示紅燈。
4. 無 CID 時不發送檢查請求，顯示中性提示。
5. 自訂合法 HTTPS gateway 會被檢查並顯示對應燈號。
