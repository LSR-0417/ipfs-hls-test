function normalizeShareTime(totalSeconds) {
  const normalized = Math.floor(Number(totalSeconds));
  return Number.isFinite(normalized) && normalized > 0 ? normalized : 0;
}

export function buildShareUrl(currentHref, cid, totalSeconds = 0) {
  const normalizedCid = String(cid || '').trim();
  if (!normalizedCid || !currentHref) {
    return '';
  }

  const currentUrl = new URL(currentHref, 'http://localhost');
  const shareUrl = new URL(currentUrl.origin + currentUrl.pathname);

  shareUrl.searchParams.set('cid', normalizedCid);

  const normalizedTime = normalizeShareTime(totalSeconds);
  if (normalizedTime > 0) {
    shareUrl.searchParams.set('t', normalizedTime);
  }

  return shareUrl.toString();
}

export function formatShareStartTime(totalSeconds) {
  const normalizedTime = normalizeShareTime(totalSeconds);
  const hours = Math.floor(normalizedTime / 3600);
  const minutes = Math.floor((normalizedTime % 3600) / 60);
  const seconds = normalizedTime % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }

  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}
