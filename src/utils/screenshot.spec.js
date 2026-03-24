import { describe, expect, it, vi } from 'vitest';
import {
  buildVideoScreenshotFilename,
  captureVideoScreenshot,
  downloadScreenshotBlob,
  formatScreenshotTimestamp,
  isVideoScreenshotReady,
  screenshotErrorCodeDownloadUnavailable,
  screenshotErrorCodeFrameNotReady,
  screenshotMimeType,
} from './screenshot';

describe('isVideoScreenshotReady', () => {
  it('returns true when the video element has decoded frame data', () => {
    expect(
      isVideoScreenshotReady({
        videoWidth: 1920,
        videoHeight: 1080,
        readyState: 3,
      })
    ).toBe(true);
  });

  it('returns false when the video element is missing metadata or frame data', () => {
    expect(isVideoScreenshotReady(null)).toBe(false);
    expect(
      isVideoScreenshotReady({
        videoWidth: 0,
        videoHeight: 1080,
        readyState: 3,
      })
    ).toBe(false);
    expect(
      isVideoScreenshotReady({
        videoWidth: 1920,
        videoHeight: 1080,
        readyState: 1,
      })
    ).toBe(false);
  });
});

describe('formatScreenshotTimestamp', () => {
  it('formats the current playback time as a stable hh-mm-ss-ms label', () => {
    expect(formatScreenshotTimestamp(83.456)).toBe('00-01-23-456');
    expect(formatScreenshotTimestamp(3723.004)).toBe('01-02-03-004');
  });
});

describe('buildVideoScreenshotFilename', () => {
  it('includes the cid and playback timestamp in the download filename', () => {
    expect(buildVideoScreenshotFilename({ cid: 'bafy-test-cid', currentTime: 83.456 })).toBe(
      'ipfs-hls-bafy-test-cid-00-01-23-456.png'
    );
  });

  it('sanitizes unsafe filename characters and falls back when cid is missing', () => {
    expect(buildVideoScreenshotFilename({ cid: 'bad:/cid?name', currentTime: 0 })).toBe(
      'ipfs-hls-bad-cid-name-00-00-00-000.png'
    );
    expect(buildVideoScreenshotFilename({ cid: '', currentTime: 0 })).toBe('ipfs-hls-video-00-00-00-000.png');
  });
});

describe('captureVideoScreenshot', () => {
  it('renders the current video frame into a png blob', async () => {
    const drawImage = vi.fn();
    const toBlob = vi.fn((callback, mimeType) => {
      callback(new Blob(['frame'], { type: mimeType }));
    });
    const canvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => ({
        drawImage,
      })),
      toBlob,
    };
    const videoElement = {
      videoWidth: 1280,
      videoHeight: 720,
      readyState: 3,
    };

    const blob = await captureVideoScreenshot(videoElement, {
      canvasFactory: () => canvas,
    });

    expect(canvas.width).toBe(1280);
    expect(canvas.height).toBe(720);
    expect(drawImage).toHaveBeenCalledWith(videoElement, 0, 0, 1280, 720);
    expect(toBlob).toHaveBeenCalledWith(expect.any(Function), screenshotMimeType);
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe(screenshotMimeType);
  });

  it('rejects when the video frame is not ready yet', async () => {
    await expect(
      captureVideoScreenshot({
        videoWidth: 0,
        videoHeight: 720,
        readyState: 1,
      })
    ).rejects.toMatchObject({
      message: screenshotErrorCodeFrameNotReady,
    });
  });

  it('surfaces security errors from tainted canvases', async () => {
    const securityError = Object.assign(new Error('Tainted canvases may not be exported.'), {
      name: 'SecurityError',
    });
    const canvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => ({
        drawImage: vi.fn(),
      })),
      toBlob() {
        throw securityError;
      },
    };

    await expect(
      captureVideoScreenshot(
        {
          videoWidth: 1280,
          videoHeight: 720,
          readyState: 3,
        },
        {
          canvasFactory: () => canvas,
        }
      )
    ).rejects.toBe(securityError);
  });
});

describe('downloadScreenshotBlob', () => {
  it('creates a temporary anchor download and revokes the object url', () => {
    const click = vi.fn();
    const remove = vi.fn();
    const appendChild = vi.fn();
    const createObjectURL = vi.fn(() => 'blob:test-url');
    const revokeObjectURL = vi.fn();
    const link = {
      click,
      remove,
      style: {},
    };

    const objectUrl = downloadScreenshotBlob(new Blob(['frame']), 'frame.png', {
      documentLike: {
        body: {
          appendChild,
        },
        createElement(tagName) {
          expect(tagName).toBe('a');
          return link;
        },
      },
      createObjectURL,
      revokeObjectURL,
      scheduleCleanup(cleanup) {
        cleanup();
      },
    });

    expect(objectUrl).toBe('blob:test-url');
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(appendChild).toHaveBeenCalledWith(link);
    expect(link.download).toBe('frame.png');
    expect(link.href).toBe('blob:test-url');
    expect(click).toHaveBeenCalledTimes(1);
    expect(remove).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:test-url');
  });

  it('throws when the browser download APIs are unavailable', () => {
    expect(() => downloadScreenshotBlob(new Blob(['frame']), 'frame.png', { documentLike: null })).toThrow(
      screenshotErrorCodeDownloadUnavailable
    );
  });
});
