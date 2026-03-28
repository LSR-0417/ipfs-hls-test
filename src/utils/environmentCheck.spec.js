import { describe, expect, it, vi } from 'vitest';
import {
  buildEnvironmentCheckUrl,
  createEnvironmentCheckStateFromPayload,
  createFailureEnvironmentCheckState,
  createIdleEnvironmentCheckState,
  createRunningEnvironmentCheckState,
  fetchEnvironmentCheck,
  formatCapabilityStatusText,
  formatEnvironmentStateLabel,
  normalizeEnvironmentCheckPayload,
} from './environmentCheck';

describe('buildEnvironmentCheckUrl', () => {
  it('builds a query string from the target host and port', () => {
    expect(
      buildEnvironmentCheckUrl('/api', {
        gatewayHost: '127.0.0.1',
        gatewayPort: '8080',
      })
    ).toBe('/api/environment/check?gatewayHost=127.0.0.1&gatewayPort=8080');
  });
});

describe('normalizeEnvironmentCheckPayload', () => {
  it('derives a success summary when all capabilities are available', () => {
    const payload = normalizeEnvironmentCheckPayload({
      ok: true,
      checkedAt: '2026-03-28T12:34:56.000Z',
      target: {
        host: '127.0.0.1',
        gatewayPort: 8080,
      },
      capabilities: [
        { id: 'nodejs', label: 'node.js', status: 'available', version: 'v22.0.0' },
        { id: 'ffmpeg', label: 'ffmpeg', status: 'available', version: 'ffmpeg version 7.1' },
      ],
    });

    expect(payload.summary).toEqual({
      status: 'success',
      total: 2,
      available: 2,
      failed: 0,
      failedCapabilities: [],
    });
  });

  it('derives a failure summary when at least one capability is unavailable', () => {
    const payload = normalizeEnvironmentCheckPayload({
      ok: true,
      capabilities: [
        { id: 'nodejs', label: 'node.js', status: 'available' },
        { id: 'ipfsNode', label: 'ipfs node', status: 'unreachable' },
      ],
    });

    expect(payload.summary).toEqual({
      status: 'failure',
      total: 2,
      available: 1,
      failed: 1,
      failedCapabilities: ['ipfs node'],
    });
  });
});

describe('environment check state factories', () => {
  it('creates an idle state by default', () => {
    expect(createIdleEnvironmentCheckState().status).toBe('idle');
  });

  it('keeps the previous capabilities while running', () => {
    const state = createRunningEnvironmentCheckState({
      previous: {
        capabilities: [{ id: 'nodejs', label: 'node.js', status: 'available' }],
      },
    });

    expect(state.status).toBe('running');
    expect(state.capabilities).toHaveLength(1);
  });

  it('builds a failure state with a custom message', () => {
    const state = createFailureEnvironmentCheckState('backend unavailable');
    expect(state).toMatchObject({
      status: 'failure',
      detail: 'backend unavailable',
    });
  });

  it('creates a success state from the backend payload', () => {
    const state = createEnvironmentCheckStateFromPayload({
      ok: true,
      capabilities: [{ id: 'nodejs', label: 'node.js', status: 'available' }],
    });

    expect(state.status).toBe('success');
    expect(state.detail).toContain('全部可用');
  });
});

describe('fetchEnvironmentCheck', () => {
  it('normalizes the backend response on success', async () => {
    const response = await fetchEnvironmentCheck({
      fetchImpl: vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          ok: true,
          capabilities: [{ id: 'nodejs', label: 'node.js', status: 'available' }],
        }),
      }),
    });

    expect(response.summary.status).toBe('success');
  });

  it('throws the backend error message on failure', async () => {
    await expect(
      fetchEnvironmentCheck({
        fetchImpl: vi.fn().mockResolvedValue({
          ok: false,
          status: 400,
          json: vi.fn().mockResolvedValue({
            ok: false,
            error: {
              code: 'INVALID_GATEWAY_PORT',
              message: 'gatewayPort 必須是 1 到 65535 的整數。',
            },
          }),
        }),
      })
    ).rejects.toThrow('gatewayPort 必須是 1 到 65535 的整數。');
  });
});

describe('formatters', () => {
  it('formats the environment state label', () => {
    expect(formatEnvironmentStateLabel('idle')).toBe('尚未檢測');
    expect(formatEnvironmentStateLabel('running')).toBe('檢測中');
    expect(formatEnvironmentStateLabel('success')).toBe('檢測成功');
    expect(formatEnvironmentStateLabel('failure')).toBe('檢測失敗');
  });

  it('formats capability status text with versions when available', () => {
    expect(formatCapabilityStatusText({ status: 'available', version: 'v22.0.0' })).toBe('可用 · v22.0.0');
    expect(formatCapabilityStatusText({ status: 'missing' })).toBe('缺少');
    expect(formatCapabilityStatusText({ status: 'unreachable' })).toBe('無法連線');
  });
});
