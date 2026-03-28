import { buildGatewayAssetUrl, buildGatewayIndexUrl } from './gateway';

const PLAYLIST_FILE_NAME = 'playlist.json';
const htmlContentTypePattern = /\btext\/html\b/i;

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeEpisodeNumber(value) {
  const numeric = Number.parseInt(value ?? '', 10);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : 0;
}

function normalizeEpisodeCid(value) {
  return normalizeString(value).replace(/^\/ipfs\//, '').replace(/\/+$/, '');
}

export function normalizeEpisodePath(value) {
  const normalized = normalizeString(value).replace(/^\/+/, '').replace(/\/+$/, '');
  return normalized
    .split('/')
    .map((segment) => segment.trim())
    .filter(Boolean)
    .join('/');
}

export function normalizePlaylistEpisode(payload = {}) {
  return {
    id: normalizeString(payload.id),
    cid: normalizeEpisodeCid(payload.cid),
    number: normalizeEpisodeNumber(payload.number),
    title: normalizeString(payload.title),
    uploader: normalizeString(payload.uploader),
    durationString: normalizeString(payload.durationString ?? payload.duration_string),
    path: normalizeEpisodePath(payload.path),
    playable: payload.playable === true,
  };
}

export function normalizePlaylistManifest(payload = {}) {
  const episodes = Array.isArray(payload?.episodes)
    ? payload.episodes
        .map((episode) => normalizePlaylistEpisode(episode))
        .filter((episode) => episode.id || episode.path || episode.cid)
    : [];

  return {
    version: Number.parseInt(payload?.version ?? '', 10),
    title: normalizeString(payload?.title),
    episodes,
  };
}

export function isValidPlaylistManifest(payload = {}) {
  if (!Number.isInteger(payload?.version) || payload.version <= 0) {
    return false;
  }

  if (!normalizeString(payload?.title)) {
    return false;
  }

  if (!Array.isArray(payload?.episodes)) {
    return false;
  }

  return payload.episodes.every((episode) => {
    if (!normalizeString(episode?.id)) return false;
    if (!normalizeString(episode?.title)) return false;
    if (!normalizeEpisodePath(episode?.path) && !normalizeEpisodeCid(episode?.cid)) return false;
    if (!Number.isInteger(episode?.number) || episode.number <= 0) return false;
    return typeof episode?.playable === 'boolean';
  });
}

export function resolveFirstPlayableEpisode(playlist = {}) {
  if (!Array.isArray(playlist?.episodes)) {
    return null;
  }

  return playlist.episodes.find((episode) => episode.playable) || null;
}

export function resolveSelectedPlaylistEpisode(playlist = {}, preferredPath = '') {
  if (!Array.isArray(playlist?.episodes) || playlist.episodes.length === 0) {
    return null;
  }

  const normalizedPreferredPath = normalizeEpisodePath(preferredPath);
  if (normalizedPreferredPath) {
    const matchedEpisode = playlist.episodes.find(
      (episode) => episode.playable && normalizeEpisodePath(episode.path) === normalizedPreferredPath
    );
    if (matchedEpisode) {
      return matchedEpisode;
    }
  }

  return resolveFirstPlayableEpisode(playlist);
}

export function buildSeriesEpisodeCid(seriesCid, episodePath) {
  const normalizedSeriesCid = normalizeString(seriesCid);
  const normalizedEpisodePath = normalizeEpisodePath(episodePath);

  if (!normalizedSeriesCid || !normalizedEpisodePath) {
    return '';
  }

  return `${normalizedSeriesCid}/${normalizedEpisodePath}`;
}

export function buildPlayableEpisodeCid(seriesCid, episode = {}) {
  const normalizedEpisodeCid = normalizeEpisodeCid(episode?.cid);
  if (normalizedEpisodeCid) {
    return normalizedEpisodeCid;
  }

  return buildSeriesEpisodeCid(seriesCid, episode?.path);
}

export async function fetchPlaylistManifest(seriesCid, gatewayUrl, options = {}) {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const playlistUrl = buildGatewayAssetUrl(gatewayUrl, seriesCid, PLAYLIST_FILE_NAME);

  if (!playlistUrl || typeof fetchImpl !== 'function') {
    return {
      status: 'error',
      playlist: null,
      detail: '無法建立 playlist.json 請求',
    };
  }

  try {
    const response = await fetchImpl(playlistUrl, {
      method: 'GET',
      cache: options.cacheMode || 'no-store',
      headers: {
        accept: 'application/json,text/plain;q=0.9,*/*;q=0.1',
      },
    });

    if (!response?.ok) {
      return {
        status: response?.status === 404 ? 'missing' : 'error',
        playlist: null,
        detail: response?.status === 404 ? '找不到 playlist.json' : '無法載入 playlist.json',
      };
    }

    const contentType = typeof response.headers?.get === 'function' ? response.headers.get('content-type') || '' : '';
    if (htmlContentTypePattern.test(contentType)) {
      return {
        status: 'invalid',
        playlist: null,
        detail: 'playlist.json 回傳了 HTML 內容',
      };
    }

    const payload = typeof response.json === 'function' ? await response.json() : JSON.parse(await response.text());
    const normalizedPlaylist = normalizePlaylistManifest(payload);

    if (!isValidPlaylistManifest(normalizedPlaylist)) {
      return {
        status: 'invalid',
        playlist: null,
        detail: 'playlist.json 缺少必要欄位或格式不正確',
      };
    }

    return {
      status: 'ok',
      playlist: normalizedPlaylist,
      detail: '',
    };
  } catch (_) {
    return {
      status: 'error',
      playlist: null,
      detail: '無法載入 playlist.json',
    };
  }
}

export async function checkDirectVideoAvailability(cid, gatewayUrl, options = {}) {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const playlistUrl = buildGatewayIndexUrl(gatewayUrl, cid);

  if (!playlistUrl || typeof fetchImpl !== 'function') {
    return false;
  }

  try {
    const response = await fetchImpl(playlistUrl, {
      method: 'GET',
      cache: options.cacheMode || 'no-store',
      headers: {
        accept: 'application/vnd.apple.mpegurl,application/x-mpegURL,text/plain;q=0.9,*/*;q=0.1',
      },
    });

    return response?.ok === true;
  } catch (_) {
    return false;
  }
}
