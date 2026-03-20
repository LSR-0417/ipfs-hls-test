#!/bin/bash

set -euo pipefail

json_quote() {
    local value="$1"
    value="${value//\\/\\\\}"
    value="${value//\"/\\\"}"
    value="${value//$'\n'/\\n}"
    value="${value//$'\r'/\\r}"
    value="${value//$'\t'/\\t}"
    printf '"%s"' "$value"
}

target_dir="${1:-.}"

if [ ! -d "$target_dir" ]; then
    echo "❌ 錯誤：找不到目標資料夾: $target_dir"
    exit 1
fi

manifest_path="$target_dir/subtitles.json"

shopt -s nullglob
subtitle_files=("$target_dir"/*.vtt)
shopt -u nullglob

{
    printf '{\n'
    printf '  "version": 1,\n'
    printf '  "tracks": ['

    for i in "${!subtitle_files[@]}"; do
        subtitle_file="${subtitle_files[$i]}"
        subtitle_name="$(basename "$subtitle_file")"
        subtitle_lang="${subtitle_name%.vtt}"

        if [ "$i" -gt 0 ]; then
            printf ','
        fi

        printf '\n    {"lang": %s, "path": %s}' \
            "$(json_quote "$subtitle_lang")" \
            "$(json_quote "$subtitle_name")"
    done

    if [ "${#subtitle_files[@]}" -gt 0 ]; then
        printf '\n'
    fi

    printf '  ]\n'
    printf '}\n'
} > "$manifest_path"

echo "✅ 字幕 manifest 已存入: $manifest_path"
