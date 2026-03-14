#!/bin/bash

# 檢查必備工具 (FFmpeg)
if ! command -v ffmpeg &> /dev/null; then
    echo "❌ 錯誤：系統找不到 FFmpeg 核心套件。"
    echo "💡 Mac 用戶請先在終端機執行以下指令，透過 Homebrew 進行安裝："
    echo "   brew install ffmpeg"
    exit 1
fi

# 檢查是否提供輸入檔案
INPUT_FILE="$1"
if [ -z "$INPUT_FILE" ]; then
    echo "❌ 錯誤：請提供影片檔案路徑。"
    echo "💡 用法範例： ./multi_resolution_hls.sh my_video.mp4"
    exit 1
fi

# 取得去副檔名的主檔名，做為同名資料夾名稱
BASENAME="${INPUT_FILE%.*}"

# 透過 ffprobe 讀取影片的原始高度 (解析度)
HEIGHT=$(ffprobe -v error -select_streams v:0 -show_entries stream=height -of default=nw=1:nk=1 "$INPUT_FILE")

if [ -z "$HEIGHT" ]; then
    echo "❌ 錯誤：無法讀取影片解析度，請確認檔案格式是否正確且包含影像軌。"
    exit 1
fi

echo "✅ 偵測到原始影片高度：${HEIGHT}p，開始動態生成轉檔架構..."

# 建立與影片同名的主資料夾
mkdir -p "$BASENAME"

# 初始化 FFmpeg 參數陣列與變數
MAP_ARGS=()
FILTER_ARGS=()
VAR_STREAM_MAP=""
STREAM_INDEX=0

# 定義一個建立畫質設定的輔助函數
add_resolution() {
    local name=$1
    local scale=$2
    local bitrate=$3
    local maxrate=$4
    local bufsize=$5

    echo "   - 加入畫質階層：$name (${scale}p)"

    # 1. 建立對應的子資料夾 (例如: my_video/4k)
    mkdir -p "${BASENAME}/${name}"

    # 2. 組合 FFmpeg 的 Map 與 Video Filter 參數
    MAP_ARGS+=("-map" "0:v:0" "-map" "0:a:0")
    FILTER_ARGS+=("-filter:v:${STREAM_INDEX}" "scale=-2:${scale}" "-b:v:${STREAM_INDEX}" "${bitrate}" "-maxrate:v:${STREAM_INDEX}" "${maxrate}" "-bufsize:v:${STREAM_INDEX}" "${bufsize}")

    # 3. 組合 var_stream_map，使用 name 屬性來替換後續的 %v 變數
    if [ -z "$VAR_STREAM_MAP" ]; then
        VAR_STREAM_MAP="v:${STREAM_INDEX},a:${STREAM_INDEX},name:${name}"
    else
        VAR_STREAM_MAP="${VAR_STREAM_MAP} v:${STREAM_INDEX},a:${STREAM_INDEX},name:${name}"
    fi

    ((STREAM_INDEX++))
}

# 根據原始解析度，由高到低判斷並動態加入設定
if [ "$HEIGHT" -ge 2160 ]; then add_resolution "4k" 2160 "15000k" "16000k" "30000k"; fi
if [ "$HEIGHT" -ge 1440 ]; then add_resolution "2k" 1440 "8000k" "8600k" "16000k"; fi
if [ "$HEIGHT" -ge 1080 ]; then add_resolution "1080p" 1080 "5000k" "5300k" "10000k"; fi
if [ "$HEIGHT" -ge 720 ];  then add_resolution "720p" 720 "2800k" "3000k" "5600k"; fi
if [ "$HEIGHT" -ge 480 ];  then add_resolution "480p" 480 "1400k" "1500k" "2800k"; fi

# 避免輸入的影片連 480p 都不到，提供一個保底機制
if [ "$STREAM_INDEX" -eq 0 ]; then
    echo "⚠️ 影片解析度低於 480p，將僅以原始解析度轉出。"
    add_resolution "orig" "$HEIGHT" "1000k" "1000k" "2000k"
fi

echo "🚀 開始執行 FFmpeg 轉檔 (這可能需要一段時間)..."

# 執行 FFmpeg
ffmpeg -i "$INPUT_FILE" \
  "${MAP_ARGS[@]}" \
  -c:v libx264 -c:a aac \
  "${FILTER_ARGS[@]}" \
  -f hls \
  -hls_time 5 \
  -hls_playlist_type vod \
  -hls_segment_filename "${BASENAME}/%v/segment_%03d.ts" \
  -master_pl_name "index.m3u8" \
  -var_stream_map "$VAR_STREAM_MAP" \
  "${BASENAME}/%v/temp.m3u8"

echo "改名中..."

# 修復檔名：將 playlist 與 segment 重新命名為要求的格式

# 遍歷剛產出的資料夾
for dir in "${BASENAME}"/*/; do
    dir=${dir%/} # 去掉結尾斜線
    folder_name=$(basename "$dir")
    variant_playlist="$dir/streaminglist-${folder_name}.m3u8"
    
    # 如果裡面有 temp.m3u8，就改成 streaminglist-畫質.m3u8
    if [ -f "$dir/temp.m3u8" ]; then
        mv "$dir/temp.m3u8" "$variant_playlist"
    fi

    # 將 segment 檔名補上畫質名稱，避免不同畫質的片段名稱過於相似。
    for segment_path in "$dir"/segment_*.ts; do
        [ -f "$segment_path" ] || continue

        segment_name=$(basename "$segment_path")
        segment_suffix="${segment_name#segment_}"
        mv "$segment_path" "$dir/segment_${folder_name}_${segment_suffix}"
    done

    # 同步更新 variant playlist 內的 segment 路徑引用。
    if [ -f "$variant_playlist" ]; then
        sed -E -i '' "s|segment_([0-9]+)\.ts|segment_${folder_name}_\\1.ts|g" "$variant_playlist"
    fi
done

# 同步修正 index.m3u8 (Master Playlist) 裡面的路徑引用
# 只替換同一路徑下的 temp.m3u8，避免所有畫質都被改成相同檔名。
sed -E -i '' 's|([^/]+)/temp\.m3u8|\1/streaminglist-\1.m3u8|g' "${BASENAME}/index.m3u8"

echo "🎉 轉檔與資料夾建置完成！"
