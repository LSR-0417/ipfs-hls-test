# 影片轉檔

本文件以目前實作的 [`script/multi_resolution_hls.sh`](/Users/iskku/Project/ipfs-hls-test/script/multi_resolution_hls.sh) 為準，說明本專案目前的 HLS 轉檔方式。

## 1. 使用方式

```bash
./script/multi_resolution_hls.sh /path/to/video.mp4
```

此腳本只接受一個輸入影片參數，會在輸入影片同層建立一個同 basename 的輸出資料夾。

例如：

- 輸入：`/video/demo.mp4`
- 輸出：`/video/demo/`

## 2. 執行前需求

執行環境需提供：

- `bash`
- `ffmpeg`
- `ffprobe`
- `sed`
- `mkdir`
- `mv`

目前腳本使用 `sed -i ''`，因此預設目標平台為 macOS / BSD `sed` 環境。

## 3. 轉檔流程

腳本的實際流程如下：

1. 檢查 `ffmpeg` 是否存在
2. 讀取輸入影片路徑
3. 用 `ffprobe` 取得第一條影像軌高度
4. 根據來源高度，自動決定要輸出的畫質層級
5. 以單次 `ffmpeg` 執行完成所有 variant 輸出
6. 將 FFmpeg 產生的 `temp.m3u8` 改名為 `streaminglist-{quality}.m3u8`
7. 將分段檔名改為 `segment_{quality}_{NNN}.ts`
8. 同步修正 root `index.m3u8` 與 variant playlist 內的引用

## 4. 自動畫質層級

目前畫質階層依來源高度動態決定：

| 條件 | 輸出資料夾 |
|------|------------|
| `HEIGHT >= 2160` | `4k`、`2k`、`1080p`、`720p`、`480p` |
| `HEIGHT >= 1440` | `2k`、`1080p`、`720p`、`480p` |
| `HEIGHT >= 1080` | `1080p`、`720p`、`480p` |
| `HEIGHT >= 720`  | `720p`、`480p` |
| `HEIGHT >= 480`  | `480p` |
| `HEIGHT < 480`   | `orig` |

## 5. 輸出命名

目前輸出命名固定如下：

- root playlist：`index.m3u8`
- variant playlist：`streaminglist-{quality}.m3u8`
- segment：`segment_{quality}_{NNN}.ts`

## 6. 輸出結構範例

若輸入影片最終輸出 `1080p`、`720p`、`480p`，結果大致如下：

```text
demo/
├── index.m3u8
├── 1080p/
│   ├── streaminglist-1080p.m3u8
│   ├── segment_1080p_000.ts
│   ├── segment_1080p_001.ts
│   └── ...
├── 720p/
│   ├── streaminglist-720p.m3u8
│   ├── segment_720p_000.ts
│   └── ...
└── 480p/
    ├── streaminglist-480p.m3u8
    ├── segment_480p_000.ts
    └── ...
```

## 7. 與播放器的關聯

前端播放器目前以：

```text
<gateway>/ipfs/<CID>/index.m3u8
```

作為 HLS 載入入口，因此轉檔完成後最重要的入口檔案就是 root `index.m3u8`。

## 8. 不在此腳本責任內的事項

此腳本目前不負責：

- 上傳到 IPFS
- 產生或搬移字幕
- 生成 `info.json`
- 處理封面與頭像
- 驗證特定 gateway 上的實際播放結果

若要整理 sidecar metadata / 字幕，請搭配：

- [`script/download_youtube_assets.sh`](/Users/iskku/Project/ipfs-hls-test/script/download_youtube_assets.sh)
- [`script/package_youtube_assets.sh`](/Users/iskku/Project/ipfs-hls-test/script/package_youtube_assets.sh)
- [`script/generate_subtitles_manifest.sh`](/Users/iskku/Project/ipfs-hls-test/script/generate_subtitles_manifest.sh)
