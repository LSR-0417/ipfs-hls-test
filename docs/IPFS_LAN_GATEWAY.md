# IPFS Desktop 開放 Gateway 內網監聽

要讓區域網路（LAN）內的其他裝置透過你的 IP 存取 IPFS 資源，需要修改 IPFS gateway 的監聽地址。

> 注意：本專案前端只有在開發模式 (`npm run dev`) 時，才會在 Gateway Settings 顯示 `Local Node` 相關設定 UI。這份文件說明的是 IPFS 端的設定方式，不保證 production build 會直接暴露本地 gateway 選項。

## 設定步驟

### 1. 開啟 IPFS 設定檔

1. 開啟 **IPFS Desktop**
2. 進入 **Settings**
3. 找到 **IPFS Config**（JSON）

### 2. 修改 Gateway 監聽地址

預設通常為：

```json
"Gateway": "/ip4/127.0.0.1/tcp/8080"
```

若要允許 LAN 內其他裝置連入，改為：

```json
"Gateway": "/ip4/0.0.0.0/tcp/8080"
```

### 3. 儲存並重啟

儲存設定後重啟 IPFS 節點。

## 驗證

從 LAN 內其他裝置嘗試存取：

```text
http://<你的電腦IP>:8080/ipfs/<任意CID>
```

例如：

```text
http://192.168.1.70:8080/ipfs/QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG/readme
```

如果能看到內容，代表 gateway 已開放內網監聽。

## 注意事項

- 僅建議在信任的區域網路中使用
- 若有防火牆，需確認 `8080` 已開放
- 前端仍然需要 gateway 端正確設定 CORS，否則瀏覽器請求可能失敗
- CLI 等效指令：

```bash
ipfs config Addresses.Gateway /ip4/0.0.0.0/tcp/8080
```
