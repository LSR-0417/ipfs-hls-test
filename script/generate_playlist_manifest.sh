#!/bin/bash

set -euo pipefail

target_dir="${1:-.}"
series_title="${2:-}"

if [ ! -d "$target_dir" ]; then
    echo "❌ 錯誤：找不到目標資料夾: $target_dir"
    exit 1
fi

node - "$target_dir" "$series_title" <<'NODE'
const fs = require('node:fs');
const path = require('node:path');

const [, , targetDirArg, explicitSeriesTitle = ''] = process.argv;
const targetDir = path.resolve(targetDirArg || '.');
const manifestPath = path.join(targetDir, 'playlist.json');

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (_) {
    return null;
  }
}

function readText(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (_) {
    return '';
  }
}

function extractEpisodeNumber(folderName) {
  const match = normalizeString(folderName).match(/(\d+)/);
  if (!match) return null;

  const numeric = Number.parseInt(match[1], 10);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}

function formatEpisodeFallbackTitle(folderName, episodeNumber) {
  if (Number.isInteger(episodeNumber) && episodeNumber > 0) {
    return `Episode ${String(episodeNumber).padStart(2, '0')}`;
  }

  return folderName;
}

function resolveSeriesTitle() {
  const normalizedExplicitTitle = normalizeString(explicitSeriesTitle);
  if (normalizedExplicitTitle) {
    return normalizedExplicitTitle;
  }

  const existingManifest = readJson(manifestPath);
  const existingTitle = normalizeString(existingManifest?.title);
  if (existingTitle) {
    return existingTitle;
  }

  return path.basename(targetDir);
}

const episodeEntries = fs
  .readdirSync(targetDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
  .map((entry) => {
    const folderName = entry.name;
    const folderPath = path.join(targetDir, folderName);
    const infoJsonPath = path.join(folderPath, 'info.json');
    const indexPath = path.join(folderPath, 'index.m3u8');
    const cidPath = path.join(folderPath, 'cid.txt');
    const infoJson = readJson(infoJsonPath);
    const hasInfoJson = Boolean(infoJson);
    const hasIndex = fs.existsSync(indexPath);

    if (!hasInfoJson && !hasIndex) {
      return null;
    }

    const episodeNumber = extractEpisodeNumber(folderName);
    const episodeTitle = normalizeString(infoJson?.title) || formatEpisodeFallbackTitle(folderName, episodeNumber);
    const episodeCid =
      normalizeString(infoJson?.cid || infoJson?.video_cid || infoJson?.source_cid) || normalizeString(readText(cidPath));
    const uploader = normalizeString(infoJson?.uploader);
    const durationString = normalizeString(infoJson?.duration_string || infoJson?.durationString);

    return {
      id: folderName,
      cid: episodeCid,
      path: folderName,
      number: episodeNumber,
      title: episodeTitle,
      uploader,
      durationString,
      playable: hasIndex,
    };
  })
  .filter(Boolean)
  .sort((left, right) => {
    const leftNumber = Number.isInteger(left.number) ? left.number : Number.MAX_SAFE_INTEGER;
    const rightNumber = Number.isInteger(right.number) ? right.number : Number.MAX_SAFE_INTEGER;

    if (leftNumber !== rightNumber) {
      return leftNumber - rightNumber;
    }

    return left.path.localeCompare(right.path, 'en');
  })
  .map((entry, index) => {
    const episode = {
      id: entry.id,
      number: Number.isInteger(entry.number) ? entry.number : index + 1,
      title: entry.title,
      path: entry.path,
      playable: entry.playable,
    };

    if (entry.cid) {
      episode.cid = entry.cid;
    }

    if (entry.uploader) {
      episode.uploader = entry.uploader;
    }

    if (entry.durationString) {
      episode.durationString = entry.durationString;
    }

    return episode;
  });

const manifest = {
  version: 1,
  title: resolveSeriesTitle(),
  episodes: episodeEntries,
};

fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

console.log(`✅ playlist manifest 已存入: ${manifestPath}`);
console.log(`   title: ${manifest.title}`);
console.log(`   episodes: ${manifest.episodes.length}`);
NODE
