# 影片轉檔

第一步：預先建立 5 個資料夾

首先，準備好用來存放這 5 種畫質切片的資料夾結構（0 是 4K，4 是 480p）：

```bash
mkdir -p my_4k_abr/stream_0 my_4k_abr/stream_1 my_4k_abr/stream_2 my_4k_abr/stream_3 my_4k_abr/stream_4
```

第二步：執行 4K 全解析度 ABR 轉檔指令

請把 temp.mp4 換成你的 4K 原始影片檔案。這段轉檔會非常吃 CPU 和時間，執行後可以去喝杯咖啡：

```bash
ffmpeg -i temp.mp4 \
  -map 0:v:0 -map 0:a:0 \
  -map 0:v:0 -map 0:a:0 \
  -map 0:v:0 -map 0:a:0 \
  -map 0:v:0 -map 0:a:0 \
  -map 0:v:0 -map 0:a:0 \
  -c:v libx264 -c:a aac \
  -filter:v:0 scale=-2:2160 -b:v:0 15000k -maxrate:v:0 16000k -bufsize:v:0 30000k \
  -filter:v:1 scale=-2:1440 -b:v:1 8000k  -maxrate:v:1 8600k  -bufsize:v:1 16000k \
  -filter:v:2 scale=-2:1080 -b:v:2 5000k  -maxrate:v:2 5300k  -bufsize:v:2 10000k \
  -filter:v:3 scale=-2:720  -b:v:3 2800k  -maxrate:v:3 3000k  -bufsize:v:3 5600k \
  -filter:v:4 scale=-2:480  -b:v:4 1400k  -maxrate:v:4 1500k  -bufsize:v:4 2800k \
  -f hls \
  -hls_time 5 \
  -hls_playlist_type vod \
  -hls_segment_filename "my_4k_abr/stream_%v/segment_%03d.ts" \
  -master_pl_name output.m3u8 \
  -var_stream_map "v:0,a:0 v:1,a:1 v:2,a:2 v:3,a:3 v:4,a:4" \
  "my_4k_abr/stream_%v/playlist.m3u8"
```

第三步：串流多解析度的資料夾結構

> 📌 產生的 `master.m3u8` 可直接交給前端播放器（例如
> 使用本專案的 `VideoPlayer.vue`）處理；播放器會讀取
> manifest 裡的 `#EXT-X-STREAM-INF` 條目並自動建立多畫質
> 選單。若不想使用 HLS，也可以保留這些分流 mp4/ts 檔案，
> 並把它們以 `{src,type,size}` 格式提供給 Plyr 的
> `sources` 屬性。

採用前端外掛字幕的方式，以下是轉檔完成後，包含字幕檔放置位置的專案資料夾結構參考：

```plantext
my_4k_abr/              # 轉檔輸出的主資料夾
    ├── master.m3u8         # HLS 主播放清單
    ├── subtitle.vtt        # 🚩 轉換後的 VTT 字幕檔建議放在這裡
    ├── stream_0/           # 4K 畫質資料夾
    │   ├── playlist.m3u8   # 該畫質的子播放清單
    │   ├── segment_000.ts  # 影片切片檔
    │   ├── segment_001.ts
    │   └── ...
    ├── stream_1/           # 1440p 畫質資料夾
    │   └── ... (內容同上)
    ├── stream_2/           # 1080p 畫質資料夾
    │   └── ...
    ├── stream_3/           # 720p 畫質資料夾
    │   └── ...
    └── stream_4/           # 480p 畫質資料夾
        └── ...
```
