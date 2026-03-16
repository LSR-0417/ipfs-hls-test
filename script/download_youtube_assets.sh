#!/bin/bash

set -euo pipefail

if ! command -v yt-dlp >/dev/null 2>&1; then
    echo "❌ 錯誤：系統找不到 yt-dlp。"
    echo "💡 Mac 用戶可先執行：brew install yt-dlp"
    exit 1
fi

if ! command -v ffmpeg >/dev/null 2>&1; then
    echo "❌ 錯誤：系統找不到 ffmpeg。"
    echo "💡 這支腳本會用到 yt-dlp 的後處理功能，請先執行：brew install ffmpeg"
    exit 1
fi

read -r -p "請輸入 YouTube 影片網址: " raw_url

if [ -z "$raw_url" ]; then
    echo "❌ 錯誤：網址不能為空。"
    exit 1
fi

echo "🔍 正在解析影片資訊，請稍候..."

video_id="$(yt-dlp -O "%(id)s" "$raw_url")"
if [ -z "$video_id" ] || [ "$video_id" = "NA" ]; then
    echo "❌ 錯誤：無法從輸入網址解析影片 ID。"
    exit 1
fi

clean_url="https://www.youtube.com/watch?v=$video_id"
echo "✨ 已淨化網址: $clean_url"

raw_dir_name="$(yt-dlp -O "%(upload_date)s_%(uploader)s_%(title)s_%(id)s" "$clean_url")"
safe_dir_name="$(
    printf '%s' "$raw_dir_name" \
        | tr -d '/\\:*?"<>|' \
        | tr -s '[:space:]' '_' \
        | sed -E 's/_+/_/g; s/^_+//; s/_+$//'
)"

if [ -z "$safe_dir_name" ]; then
    safe_dir_name="$video_id"
fi

save_dir="./$safe_dir_name"
mkdir -p "$save_dir"
echo "📁 下載路徑已設定: $save_dir"

echo "📥 開始下載影片、字幕與中繼資料..."
yt-dlp \
  --write-info-json \
  --write-thumbnail \
  --write-subs \
  --sub-langs all \
  --convert-subs vtt \
  --no-write-comments \
  --embed-metadata \
  --embed-thumbnail \
  --embed-subs \
  -P "$save_dir" \
  "$clean_url"

echo "🖼️ 正在下載頻道頭像..."
if channel_url="$(yt-dlp -O "%(channel_url)s" "$clean_url" 2>/dev/null)"; then
    if [ -n "$channel_url" ] && [ "$channel_url" != "NA" ]; then
        if ! yt-dlp \
            --skip-download \
            --playlist-items 1 \
            --write-thumbnail \
            -o "$save_dir/channel_avatar.%(ext)s" \
            "$channel_url"; then
            echo "⚠️ 頻道頭像下載失敗，已略過。"
        fi
    else
        echo "⚠️ 取不到頻道網址，已略過頭像下載。"
    fi
else
    echo "⚠️ 解析頻道網址失敗，已略過頭像下載。"
fi

echo "🎉 全部下載完成！所有檔案已妥善存入: $save_dir"
