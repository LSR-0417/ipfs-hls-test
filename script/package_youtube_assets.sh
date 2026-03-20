#!/bin/bash

set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if ! command -v jq >/dev/null 2>&1; then
    echo "❌ 錯誤：系統找不到 jq。"
    echo "💡 Mac 用戶可先執行：brew install jq"
    exit 1
fi

echo "✂️ 正在整理 yt-dlp 下載結果 (全複製模式：保留原始檔案)..."

shopt -s nullglob
json_files=(*.info.json)
shopt -u nullglob

if [ "${#json_files[@]}" -eq 0 ]; then
    echo "⚠️ 在目前目錄找不到任何 .info.json 檔案。"
    exit 1
fi

source_json="${json_files[0]}"
if [ "${#json_files[@]}" -gt 1 ]; then
    echo "⚠️ 找到多個 .info.json，將使用第一個：$source_json"
fi

source_base="$(basename "$source_json" .info.json)"
target_dir="./$source_base"

mkdir -p "$target_dir"
echo "📄 使用來源 JSON: $source_json"

echo "💬 正在整理字幕檔..."
shopt -s nullglob
subtitle_found=0
for subtitle_file in "${source_base}".*.vtt; do
    subtitle_found=1
    clean_subtitle_name="${subtitle_file#"$source_base."}"
    cp "$subtitle_file" "$target_dir/$clean_subtitle_name"
    echo "   ➡️ 已複製字幕: $clean_subtitle_name"
done

if [ "$subtitle_found" -eq 0 ]; then
    echo "   ℹ️ 沒有找到可整理的字幕檔。"
fi

echo "🎨 正在處理影片封面..."
cover_source=""
cover_target_name=""
for candidate in "${source_base}".webp "${source_base}".jpg "${source_base}".jpeg "${source_base}".png; do
    if [ -f "$candidate" ]; then
        cover_source="$candidate"
        break
    fi
done

if [ -n "$cover_source" ]; then
    cover_ext=".${cover_source##*.}"
    cover_target_name="cover$cover_ext"
    cp "$cover_source" "$target_dir/$cover_target_name"
    echo "   ➡️ 已複製封面: $cover_target_name"
else
    echo "   ℹ️ 沒有找到影片封面。"
fi

echo "🖼️ 正在處理上傳者頭像..."
avatar_source=""
avatar_target_name=""
for candidate in channel_avatar.* *.jpg *.jpeg *.png *.webp; do
    [ -f "$candidate" ] || continue

    if [ -n "$cover_source" ] && [ "$candidate" = "$cover_source" ]; then
        continue
    fi

    case "$candidate" in
        "${source_base}".*)
            continue
            ;;
    esac

    avatar_source="$candidate"
    break
done
shopt -u nullglob

if [ -n "$avatar_source" ]; then
    avatar_ext=".${avatar_source##*.}"
    avatar_target_name="avatar$avatar_ext"
    cp "$avatar_source" "$target_dir/$avatar_target_name"
    echo "   ➡️ 已複製頭像: $avatar_target_name"
else
    echo "   ℹ️ 沒有找到可用的頭像檔。"
fi

core_info_json="$(
    jq -c '{
      id: .id,
      title: .title,
      uploader: .uploader,
      channel_id: .channel_id,
      upload_date: .upload_date,
      duration_string: .duration_string,
      description: .description,
      tags: .tags,
      categories: .categories,
      resolution: .resolution,
      fps: .fps
    }' "$source_json"
)"

core_info_json="${core_info_json//$'\n'/}"
core_info_json="${core_info_json//$'\r'/}"
printf '%s\n' "$core_info_json" > "$target_dir/info.json"

echo "✅ 精簡版 JSON 已存入: $target_dir/info.json"

"$script_dir/generate_subtitles_manifest.sh" "$target_dir"

echo
echo "🎉 全部整理完成！原始檔案皆已保留。"
echo "📂 整理後的資料夾: $target_dir"
