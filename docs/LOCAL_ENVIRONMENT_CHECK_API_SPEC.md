# 本機環境檢測 API 規範

本文件定義 `#50` 需要的前後端串接契約，用於讓前端透過本機 Node.js backend 檢測目前機器是否具備後續影片處理與 IPFS 發佈所需能力。

## 1. 目的

- 讓前端在頁面首次載入時，可向本機 backend 取得一次環境檢測結果。
- 讓前端可透過「重新檢測」按鈕再次觸發檢測。
- 讓檢測結果可明確區分哪些能力可用、哪些能力缺失或不可達。

## 2. 範圍

本規範只涵蓋：

- 前端向本機 backend 發送環境檢測請求
- backend 檢查必要 CLI 與本機 IPFS gateway 可用性
- frontend 顯示最近一次檢測狀態與能力清單

本規範不涵蓋：

- 實際影片轉檔
- 實際 `ipfs add` / 發佈流程
- CID 播放流程
- 遠端 Host / Docker 節點

## 3. Endpoint

### `GET /api/environment/check`

以唯讀方式檢查本機環境是否就緒。

#### Query Parameters

- `gatewayHost`
  - 型別：`string`
  - 預設值：`127.0.0.1`
  - 用途：指定要檢查的本機 IPFS gateway host
- `gatewayPort`
  - 型別：`number`
  - 預設值：`8080`
  - 用途：指定要檢查的本機 IPFS gateway port

#### Request Example

```http
GET /api/environment/check?gatewayHost=127.0.0.1&gatewayPort=8080
Accept: application/json
```

## 4. Response Schema

### 成功回應 `200 OK`

```json
{
  "ok": true,
  "checkedAt": "2026-03-28T12:34:56.000Z",
  "target": {
    "host": "127.0.0.1",
    "gatewayPort": 8080,
    "gatewayBaseUrl": "http://127.0.0.1:8080/"
  },
  "summary": {
    "status": "success",
    "total": 6,
    "available": 6,
    "failed": 0,
    "failedCapabilities": []
  },
  "capabilities": [
    {
      "id": "nodejs",
      "label": "node.js",
      "status": "available",
      "source": "runtime",
      "detail": "Node.js 執行中",
      "version": "v22.0.0"
    }
  ]
}
```

### 失敗回應 `400 Bad Request`

```json
{
  "ok": false,
  "error": {
    "code": "INVALID_GATEWAY_PORT",
    "message": "gatewayPort 必須是 1 到 65535 的整數。"
  }
}
```

### 伺服器錯誤 `500 Internal Server Error`

```json
{
  "ok": false,
  "error": {
    "code": "ENVIRONMENT_CHECK_FAILED",
    "message": "環境檢測失敗。"
  }
}
```

## 5. 能力清單

後端至少必須回傳以下能力項目：

- `node.js`
  - 來源：backend 目前執行中的 Node.js runtime
- `ffmpeg`
  - 來源：`ffmpeg -version`
- `ffprobe`
  - 來源：`ffprobe -version`
- `ipfs`
  - 來源：`ipfs --version`
- `jq`
  - 來源：`jq --version`
- `ipfs node`
  - 來源：對 `http://<gatewayHost>:<gatewayPort>/` 的 HTTP 可達性檢查

## 6. 狀態語意

### `summary.status`

- `success`
  - 所有必要能力皆為 `available`
- `failure`
  - 只要任一能力不是 `available`，即視為 `failure`

### `capabilities[].status`

- `available`
  - 該能力可正常使用
- `missing`
  - 找不到對應 CLI
- `unreachable`
  - 目標服務存在可達性問題，例如本機 gateway 無法連線
- `error`
  - 檢測過程發生非預期錯誤或逾時

## 7. 前端行為契約

- 頁面首次載入時，前端必須自動呼叫一次 `GET /api/environment/check`
- 前端在需要本機直連測試時，可改用可編輯的 backend host / port 組成 `http://<backendHost>:<backendPort>/api/environment/check`
- 前端必須提供「環境檢測 / 重新檢測」按鈕
- 前端必須顯示檢測目標主機
- 前端必須顯示最近一次檢測狀態：
  - `尚未檢測`
  - `檢測中`
  - `檢測成功`
  - `檢測失敗`
- 前端必須列出每個能力項目的狀態與 detail
- 若 `summary.status = failure`，前端必須明確列出不可用項目

## 8. 非功能條件

- 回應必須加上 `Cache-Control: no-store`
- 開發模式下，前端可透過 Vite `/api` proxy 導向本機 backend
- backend 檢測行為不應修改系統狀態，只能做讀取 / 探測
