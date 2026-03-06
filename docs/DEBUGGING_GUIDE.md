# 本地網關連接故障排查指南

## 🔍 常見問題

### 1. 無法連接到本地IPFS網關

#### 症狀

- 顯示「網絡錯誤：無法連接到網關」
- 狀態欄顯示連接失敗信息

#### 解決方案

**步驟1：檢查本地IPFS網關是否運行**

```bash
# 檢查IPFS網關是否在運行
curl http://127.0.0.1:8080/

# 或訪問以下URL (應該返回 Moved Permanently)
curl -I http://127.0.0.1:8080/
```

預期結果：應該看到HTML響應或301/302重定向

**步驟2：確認網關端口**
IPFS網關的默認端口是 `8080`，確保您的網關配置正確：

```bash
# 如果使用kubo (go-ipfs)：
ipfs daemon --gateway-port 8080
```

**步驟3：測試網關連接**

```bash
# 嘗試訪問具體文件
curl http://127.0.0.1:8080/ipfs/QmUvC2Fe... (替換為實際的CID)
```

### 2. CORS錯誤

#### 症狀

- 瀏覽器控制台顯示CORS相關錯誤
- 網關選擇本地，但仍無法加載

#### 解決方案

**方法A：使用開發服務器（推薦，開發時使用）**

1. 確保運行了 `npm run dev`
2. 應用應該自動通過Vite代理連接到本地網關
3. 代理路由配置在 `vite.config.js` 中

**方法B：配置IPFS網關CORS**
編輯IPFS配置文件 (~/.ipfs/config)：

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

然後重啟IPFS網關。

### 3. M3U8 文件未找到

#### 症狀

- 視頻播放器出現「無法加載媒體」
- 狀態顯示 `404` 相關錯誤

#### 解決方案

確保您輸入的CID正確：

1. CID 應該指向一個文件夾，不是單個文件
2. 文件夾中必須包含 `index.m3u8` 文件

驗證方法：

```bash
# 訪問該CID的目錄列表
curl http://127.0.0.1:8080/ipfs/<YOUR_CID>/

# 應該能看到 index.m3u8 文件
```

### 4. 字幕加載失敗

#### 症狀

- 狀態欄顯示「字幕檢測完成，找到 0 個字幕文件」
- 無法加載多語言字幕

#### 解決方案

檢查您的IPFS文件夾中是否包含字幕文件：

- `en.vtt` (English)
- `zh-TW.vtt` (Traditional Chinese)
- `zh-CN.vtt` (Simplified Chinese)
- `ko.vtt` (Korean)
- `ja.vtt` (Japanese)

驗證方法：

```bash
# 檢查文件是否存在
curl http://127.0.0.1:8080/ipfs/<YOUR_CID>/en.vtt

# 應該返回VTT格式的字幕內容
```

## 🔧 調試步驟

### 1. 檢查瀏覽器控制台日志

按 `F12` 打開開發者工具，查看 Console 標籤：

- 查找 `正在檢測字幕`、`M3U8 URL:` 等日志消息
- 注意任何紅色錯誤信息

### 2. 檢查網絡請求

在開發者工具的 Network 標籤：

1. 嘗試加載視頻
2. 查找以下請求：
   - `/ipfs/...` (M3U8 文件)
   - `index.m3u8` (主播放列表)
   - `.ts` 文件 (視頻分段)
3. 檢查返回的HTTP狀態碼
   - 200 = 成功
   - 404 = 文件不存在
   - CORS 錯誤 = 跨域問題
   - 502/503 = 網關問題

### 3. 测试特定文件

```bash
# 測試M3U8文件
curl -v 'http://127.0.0.1:8080/ipfs/<YOUR_CID>/index.m3u8'

# 應該返回 M3U8 格式的播放列表
```

## 💡 快速檢查列表

- [ ] IPFS網關正在運行 (`ipfs daemon`)
- [ ] 開發伺服器正在運行 (`npm run dev`)
- [ ] CID 格式正確（`Qm...` 或 `bafy...`）
- [ ] IPFS文件夾包含 `index.m3u8`
- [ ] 本地網關選擇為 `本地 (最穩定/測試首選)`
- [ ] 瀏覽器控制台無 CORS 錯誤
- [ ] 網絡請求返回 HTTP 200

## 📝 提交問題時請提供

如果上述步驟無法解決問題，請收集以下信息：

1. 完整的CID
2. 瀏覽器控制台的所有日志（複製粘貼整個console輸出）
3. 網絡標籤中失敗請求的完整URL和狀態碼
4. IPFS版本號 (`ipfs --version`)
5. 操作系統信息

## 🔗 有用資源

- [IPFS官方文檔](https://docs.ipfs.tech/)
- [IPFS HTTP API](https://docs.ipfs.tech/reference/http-api/)
- [Kubo 配置參考](https://github.com/ipfs/kubo/blob/master/docs/config.md)
