# 本地網關連接故障排查指南

本文件以目前前端實作為準，說明使用本地 IPFS gateway 時最常見的連線與 sidecar 載入問題。

## 1. 無法連接到本地 IPFS gateway

### 症狀

- 播放器長時間停在 `正在載入影片...`
- `index.m3u8`、`.ts` 或 `info.json` 請求失敗
- 瀏覽器 Network 面板看到 `ERR_CONNECTION_REFUSED`、`404`、`CORS` 等錯誤

### 解決方案

**步驟 1：檢查本地 gateway 是否運行**

```bash
curl http://127.0.0.1:8080/
curl -I http://127.0.0.1:8080/
```

預期結果：應該能拿到 HTML、目錄頁或 `301/302` 回應。

**步驟 2：確認 gateway 真的能讀到你的 CID**

```bash
curl -I http://127.0.0.1:8080/ipfs/<YOUR_CID>/index.m3u8
```

如果這一步失敗，前端一定也會失敗。

**步驟 3：確認前端是否真的在用本地 gateway**

目前 `Local Node` 選項只會在開發模式 (`npm run dev`) 出現。若你使用 production build，UI 不會顯示本地 gateway 設定。

## 2. CORS 錯誤

### 現況重點

目前專案沒有設定 Vite gateway proxy。`npm run dev` 只會啟動開發伺服器，不會自動代你代理 `/ipfs/...` 請求。

也就是說，瀏覽器仍然會直接向你設定的 gateway 發送請求，因此本地 gateway 若沒有正確開放 CORS，前端仍然會失敗。

### 解決方案

請直接在 IPFS gateway 端設定 CORS，例如修改 `~/.ipfs/config`：

```json
{
  "API": {
    "HTTPHeaders": {
      "Access-Control-Allow-Origin": ["*"],
      "Access-Control-Allow-Methods": ["GET", "POST", "PUT", "DELETE"],
      "Access-Control-Allow-Headers": ["Content-Type", "Range"]
    }
  }
}
```

修改後重啟 IPFS 節點。

## 3. `index.m3u8` 找不到

### 症狀

- 播放器一直沒有進入就緒狀態
- Network 面板中 `index.m3u8` 回傳 `404`

### 解決方案

確認你的 CID 指向的是包含 HLS 輸出的資料夾，而不是單一檔案。

目前前端固定以：

```text
<gateway>/ipfs/<CID>/index.m3u8
```

作為播放入口。

驗證方式：

```bash
curl http://127.0.0.1:8080/ipfs/<YOUR_CID>/
curl http://127.0.0.1:8080/ipfs/<YOUR_CID>/index.m3u8
```

## 4. sidecar metadata / 圖片沒有顯示

### 現況重點

目前前端固定請求以下檔名：

- `info.json`
- `cover.webp`
- `avatar.jpg`
- `subtitles.json`

前端目前不會自動尋找 `cover.png`、`cover.jpg`、`avatar.webp` 等其他副檔名。

### 表現方式

- `info.json` 載入失敗：標題列不顯示預設標題；下方資訊卡退回預設資訊，但影片仍可播放
- `cover.webp` 缺失：播放器沒有 poster，但影片仍可播放
- `avatar.jpg` 載入失敗：退回 identicon 頭像

> 註：這裡的「預設資訊」目前只表示資訊卡會有 fallback；具體要列出哪些預設欄位與文案，待後續產品決策後再補進文件。
<!-- LLM note: Do not expand the exact fallback/default info list here yet. The user will decide the canonical default fields/text later, and the docs should stay intentionally non-exhaustive until then. -->

### 驗證方式

```bash
curl -I http://127.0.0.1:8080/ipfs/<YOUR_CID>/info.json
curl -I http://127.0.0.1:8080/ipfs/<YOUR_CID>/cover.webp
curl -I http://127.0.0.1:8080/ipfs/<YOUR_CID>/avatar.jpg
```

## 5. 字幕沒有出現

### 現況重點

目前播放器不會掃描所有可能的 `*.vtt` 檔名，而是只讀：

```text
<gateway>/ipfs/<CID>/subtitles.json
```

`subtitles.json` 內的 `tracks[].path` 再指向對應的 `.vtt`。

### 解決方案

確認 sidecar 目錄中存在：

- `subtitles.json`
- manifest 內列出的每個 `.vtt`

驗證方式：

```bash
curl http://127.0.0.1:8080/ipfs/<YOUR_CID>/subtitles.json
curl -I http://127.0.0.1:8080/ipfs/<YOUR_CID>/en.vtt
```

## 6. 調試步驟

### 1. 檢查瀏覽器 Network

請優先查看以下請求是否成功：

- `index.m3u8`
- variant playlist，例如 `1080p/streaminglist-1080p.m3u8`
- `.ts` 片段
- `info.json`
- `subtitles.json`
- `cover.webp`
- `avatar.jpg`
- manifest 中列出的 `.vtt`

### 2. 檢查播放器狀態文字

目前前端只會顯示較泛用的播放器狀態，例如：

- `正在載入影片...`
- `播放器已就緒`
- `播放器已就緒，請手動播放`
- `✅ 資源就緒！請手動播放 (將從 mm:ss 開始)。`

它不會細分顯示是 `gateway`、`metadata`、`字幕` 或 `片段` 哪一層失敗，因此 Network 面板比 Console 更有參考價值。

### 3. 直接測試完整入口

```bash
curl -v "http://127.0.0.1:8080/ipfs/<YOUR_CID>/index.m3u8"
```

若要檢查 sidecar：

```bash
curl -v "http://127.0.0.1:8080/ipfs/<YOUR_CID>/info.json"
curl -v "http://127.0.0.1:8080/ipfs/<YOUR_CID>/subtitles.json"
```

## 7. 快速檢查列表

- [ ] IPFS gateway 正在運行
- [ ] 本機或 LAN 位址可直接 `curl` 到 `index.m3u8`
- [ ] `npm run dev` 已啟動，且你知道 Local Node 選項只在 dev 模式出現
- [ ] gateway 已正確設定 CORS
- [ ] CID 對應的資料夾中包含 `index.m3u8`
- [ ] sidecar 目錄中包含 `info.json`
- [ ] 若需要 poster，sidecar 目錄中包含 `cover.webp`
- [ ] 若需要自訂頭像，sidecar 目錄中包含 `avatar.jpg`
- [ ] 若需要字幕，sidecar 目錄中包含 `subtitles.json` 與對應 `.vtt`

## 8. 提交問題時請提供

若上述步驟仍無法解決問題，請收集：

1. 完整 CID
2. 失敗請求的完整 URL 與 HTTP 狀態碼
3. 瀏覽器 Network 面板截圖或文字
4. `ipfs --version`
5. 你的作業系統與瀏覽器版本
