export const screenshotMimeType = 'image/png';
export const screenshotFileExtension = 'png';

export const screenshotErrorCodeFrameNotReady = 'VIDEO_FRAME_NOT_READY';
export const screenshotErrorCodeCanvasUnavailable = 'SCREENSHOT_CANVAS_UNAVAILABLE';
export const screenshotErrorCodeContextUnavailable = 'SCREENSHOT_CONTEXT_UNAVAILABLE';
export const screenshotErrorCodeExportUnavailable = 'SCREENSHOT_EXPORT_UNAVAILABLE';
export const screenshotErrorCodeExportFailed = 'SCREENSHOT_EXPORT_FAILED';
export const screenshotErrorCodeDownloadUnavailable = 'SCREENSHOT_DOWNLOAD_UNAVAILABLE';

const FILENAME_MAX_SEGMENT_LENGTH = 48;

function createScreenshotError(code) {
  return new Error(code);
}

function sanitizeFilenameSegment(value, fallbackValue) {
  const normalizedValue =
    typeof value === 'string'
      ? value
          .trim()
          .replace(/[<>:"/\\|?*\u0000-\u001f]+/g, '-')
          .replace(/\s+/g, '-')
          .replace(/-+/g, '-')
          .replace(/^-|-$/g, '')
      : '';

  if (!normalizedValue) {
    return fallbackValue;
  }

  return normalizedValue.slice(0, FILENAME_MAX_SEGMENT_LENGTH);
}

export function isVideoScreenshotReady(videoElement) {
  return Boolean(
    videoElement &&
      Number.isFinite(videoElement.videoWidth) &&
      videoElement.videoWidth > 0 &&
      Number.isFinite(videoElement.videoHeight) &&
      videoElement.videoHeight > 0 &&
      Number.isFinite(videoElement.readyState) &&
      videoElement.readyState >= 2
  );
}

export function formatScreenshotTimestamp(currentTimeSeconds = 0) {
  const totalMilliseconds = Math.max(0, Math.round(Number(currentTimeSeconds) * 1000) || 0);
  const hours = Math.floor(totalMilliseconds / 3600000);
  const minutes = Math.floor((totalMilliseconds % 3600000) / 60000);
  const seconds = Math.floor((totalMilliseconds % 60000) / 1000);
  const milliseconds = totalMilliseconds % 1000;

  return [hours, minutes, seconds].map((value) => String(value).padStart(2, '0')).join('-') + `-${String(milliseconds).padStart(3, '0')}`;
}

export function buildVideoScreenshotFilename(options = {}) {
  const { cid = '', currentTime = 0, prefix = 'ipfs-hls' } = options;
  const safePrefix = sanitizeFilenameSegment(prefix, 'ipfs-hls');
  const safeCid = sanitizeFilenameSegment(cid, 'video');
  const timestamp = formatScreenshotTimestamp(currentTime);

  return `${safePrefix}-${safeCid}-${timestamp}.${screenshotFileExtension}`;
}

function createCanvas(width, height) {
  if (!globalThis.document || typeof globalThis.document.createElement !== 'function') {
    throw createScreenshotError(screenshotErrorCodeCanvasUnavailable);
  }

  const canvas = globalThis.document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function exportCanvasBlob(canvas, mimeType) {
  return new Promise((resolve, reject) => {
    if (typeof canvas?.toBlob !== 'function') {
      reject(createScreenshotError(screenshotErrorCodeExportUnavailable));
      return;
    }

    try {
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
          return;
        }

        reject(createScreenshotError(screenshotErrorCodeExportFailed));
      }, mimeType);
    } catch (error) {
      reject(error);
    }
  });
}

export async function captureVideoScreenshot(videoElement, options = {}) {
  const { mimeType = screenshotMimeType, canvasFactory = createCanvas } = options;

  if (!isVideoScreenshotReady(videoElement)) {
    throw createScreenshotError(screenshotErrorCodeFrameNotReady);
  }

  const width = Math.floor(videoElement.videoWidth);
  const height = Math.floor(videoElement.videoHeight);
  const canvas = canvasFactory(width, height);

  if (!canvas || typeof canvas.getContext !== 'function') {
    throw createScreenshotError(screenshotErrorCodeCanvasUnavailable);
  }

  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');

  if (!context || typeof context.drawImage !== 'function') {
    throw createScreenshotError(screenshotErrorCodeContextUnavailable);
  }

  context.drawImage(videoElement, 0, 0, width, height);
  return exportCanvasBlob(canvas, mimeType);
}

function isBlobLike(value) {
  return Boolean(value && typeof value === 'object' && typeof value.size === 'number');
}

export function downloadScreenshotBlob(blob, filename, options = {}) {
  const documentLike = options.documentLike || globalThis.document || null;
  const createObjectURL =
    options.createObjectURL || (typeof globalThis.URL?.createObjectURL === 'function' ? globalThis.URL.createObjectURL.bind(globalThis.URL) : null);
  const revokeObjectURL =
    options.revokeObjectURL || (typeof globalThis.URL?.revokeObjectURL === 'function' ? globalThis.URL.revokeObjectURL.bind(globalThis.URL) : null);
  const scheduleCleanup =
    typeof options.scheduleCleanup === 'function'
      ? options.scheduleCleanup
      : (cleanup) => {
          if (typeof globalThis.setTimeout === 'function') {
            globalThis.setTimeout(cleanup, 0);
            return;
          }

          cleanup();
        };

  if (!isBlobLike(blob) || !documentLike || typeof documentLike.createElement !== 'function' || typeof createObjectURL !== 'function') {
    throw createScreenshotError(screenshotErrorCodeDownloadUnavailable);
  }

  const link = documentLike.createElement('a');
  if (!link || typeof link.click !== 'function') {
    throw createScreenshotError(screenshotErrorCodeDownloadUnavailable);
  }

  const objectUrl = createObjectURL(blob);
  link.href = objectUrl;
  link.download = typeof filename === 'string' && filename.trim() ? filename.trim() : buildVideoScreenshotFilename();
  link.rel = 'noopener';

  if (link.style) {
    link.style.display = 'none';
  }

  documentLike.body?.appendChild?.(link);

  try {
    link.click();
  } finally {
    link.remove?.();
    if (typeof revokeObjectURL === 'function') {
      scheduleCleanup(() => {
        revokeObjectURL(objectUrl);
      });
    }
  }

  return objectUrl;
}
