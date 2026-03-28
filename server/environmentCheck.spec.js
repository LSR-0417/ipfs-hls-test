import { describe, expect, it, vi } from 'vitest';
import {
  buildGatewayBaseUrl,
  checkCommandCapability,
  checkEnvironment,
  checkGatewayCapability,
  createEnvironmentReport,
  normalizeEnvironmentTarget,
} from './environmentCheck.mjs';

describe('normalizeEnvironmentTarget', () => {
  it('falls back to the local defaults', () => {
    expect(normalizeEnvironmentTarget()).toEqual({
      gatewayHost: '127.0.0.1',
      gatewayPort: 8080,
      gatewayBaseUrl: 'http://127.0.0.1:8080/',
    });
  });

  it('accepts explicit host and port', () => {
    expect(normalizeEnvironmentTarget({ gatewayHost: 'localhost', gatewayPort: '5001' })).toEqual({
      gatewayHost: 'localhost',
      gatewayPort: 5001,
      gatewayBaseUrl: 'http://localhost:5001/',
    });
  });

  it('rejects invalid ports', () => {
    expect(() => normalizeEnvironmentTarget({ gatewayPort: 'abc' })).toThrow('gatewayPort 必須是 1 到 65535 的整數。');
  });
});

describe('buildGatewayBaseUrl', () => {
  it('formats the gateway url from the normalized target', () => {
    expect(buildGatewayBaseUrl({ gatewayHost: '127.0.0.1', gatewayPort: 8080 })).toBe('http://127.0.0.1:8080/');
  });
});

describe('checkCommandCapability', () => {
  it('returns available when the command runner succeeds', async () => {
    const capability = await checkCommandCapability(
      {
        id: 'ffmpeg',
        label: 'ffmpeg',
        command: 'ffmpeg',
        args: ['-version'],
      },
      {
        commandRunner: vi.fn().mockResolvedValue({
          stdout: 'ffmpeg version 7.1\nbuilt with clang\n',
        }),
      }
    );

    expect(capability).toMatchObject({
      id: 'ffmpeg',
      status: 'available',
      version: 'ffmpeg version 7.1',
    });
  });

  it('marks missing commands explicitly', async () => {
    const capability = await checkCommandCapability(
      {
        id: 'jq',
        label: 'jq',
        command: 'jq',
        args: ['--version'],
      },
      {
        commandRunner: vi.fn().mockRejectedValue(
          Object.assign(new Error('not found'), {
            code: 'ENOENT',
          })
        ),
      }
    );

    expect(capability).toMatchObject({
      id: 'jq',
      status: 'missing',
      detail: '找不到 jq 指令',
    });
  });
});

describe('checkGatewayCapability', () => {
  it('marks the gateway as available when a 200 response is returned', async () => {
    const capability = await checkGatewayCapability(
      {
        gatewayHost: '127.0.0.1',
        gatewayPort: 8080,
      },
      {
        httpRequester: vi.fn().mockResolvedValue({
          statusCode: 200,
        }),
      }
    );

    expect(capability).toMatchObject({
      id: 'ipfsNode',
      status: 'available',
      detail: '可連線到 http://127.0.0.1:8080/ (HTTP 200)',
    });
  });

  it('still marks the gateway as available when the service responds with HTTP 404', async () => {
    const capability = await checkGatewayCapability(
      {
        gatewayHost: '127.0.0.1',
        gatewayPort: 8080,
      },
      {
        httpRequester: vi.fn().mockResolvedValue({
          statusCode: 404,
        }),
      }
    );

    expect(capability).toMatchObject({
      id: 'ipfsNode',
      status: 'available',
      source: 'http',
      detail: '可連線到 http://127.0.0.1:8080/ (HTTP 404)',
    });
  });

  it('marks the gateway as unreachable on request failure', async () => {
    const capability = await checkGatewayCapability(
      {
        gatewayHost: '127.0.0.1',
        gatewayPort: 8080,
      },
      {
        httpRequester: vi.fn().mockRejectedValue(new Error('connect ECONNREFUSED')),
      }
    );

    expect(capability).toMatchObject({
      id: 'ipfsNode',
      status: 'unreachable',
      source: 'http',
    });
    expect(capability.detail).toContain('connect ECONNREFUSED');
  });
});

describe('createEnvironmentReport', () => {
  it('marks the summary as failure when any capability is unavailable', () => {
    const report = createEnvironmentReport(
      {
        gatewayHost: '127.0.0.1',
        gatewayPort: 8080,
        gatewayBaseUrl: 'http://127.0.0.1:8080/',
      },
      [
        { id: 'nodejs', label: 'node.js', status: 'available' },
        { id: 'ffmpeg', label: 'ffmpeg', status: 'missing' },
      ]
    );

    expect(report.summary).toMatchObject({
      status: 'failure',
      total: 2,
      available: 1,
      failed: 1,
      failedCapabilities: ['ffmpeg'],
    });
  });
});

describe('checkEnvironment', () => {
  it('assembles the runtime, command, and gateway checks into one report', async () => {
    const report = await checkEnvironment(
      {
        gatewayHost: '127.0.0.1',
        gatewayPort: 8080,
      },
      {
        processVersion: 'v22.0.0',
        commandRunner: vi.fn().mockResolvedValue({
          stdout: 'tool version 1.0.0\n',
        }),
        httpRequester: vi.fn().mockResolvedValue({
          statusCode: 200,
        }),
      }
    );

    expect(report.summary.status).toBe('success');
    expect(report.capabilities).toHaveLength(6);
    expect(report.capabilities.map((capability) => capability.id)).toEqual([
      'nodejs',
      'ffmpeg',
      'ffprobe',
      'ipfs',
      'jq',
      'ipfsNode',
    ]);
  });
});
