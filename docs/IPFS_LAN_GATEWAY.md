# IPFS Desktop 開放 Gateway 內網監聽

要讓區域網路（LAN）內的其他裝置（如手機）透過你的 IP（例如 `192.168.1.70`）存取 IPFS 資源，需要修改 IPFS 的網關（Gateway）監聽地址。

> ⚠️ 預設情況下，IPFS 只監聽 `127.0.0.1`（本機），這會阻擋所有外部連線。

## 設定步驟

### 1. 開啟 IPFS 設定檔

1. 開啟 **IPFS Desktop** 應用程式
2. 點擊左側選單的 **「設定」(Settings)**
3. 向下捲動找到 **「IPFS 設定」(IPFS Config)** 區塊（JSON 格式）

### 2. 修改 Gateway 監聽地址

搜尋 `Addresses` 下的 `Gateway` 欄位，你會看到：

```json
"Gateway": "/ip4/127.0.0.1/tcp/8080"
```

將 `127.0.0.1` 改為 `0.0.0.0`，代表允許所有網路介面存取：

```json
"Gateway": "/ip4/0.0.0.0/tcp/8080"
```

### 3. 儲存並重啟

點擊 **「儲存」(Save)**，IPFS 節點會自動重啟以套用變更。

## 驗證

從區域網路內的其他裝置（例如手機），嘗試存取：

```
http://<你的電腦IP>:8080/ipfs/<任意CID>
```

例如：

```
http://192.168.1.70:8080/ipfs/QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG/readme
```

如果能看到內容，代表設定成功。

## 注意事項

- 此設定僅在信任的區域網路中使用，不建議在公開網路環境開放
- 若有防火牆，需確認 port `8080` 已開放
- 使用 CLI 的等效指令：
  ```bash
  ipfs config Addresses.Gateway /ip4/0.0.0.0/tcp/8080
  ```
