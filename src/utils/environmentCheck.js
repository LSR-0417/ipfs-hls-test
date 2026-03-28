export const environmentCheckState = Object.freeze({
  idle: 'idle',
  running: 'running',
  success: 'success',
  failure: 'failure',
});

const defaultApiBase = '/api';
const defaultTarget = Object.freeze({
  gatewayHost: '127.0.0.1',
  gatewayPort: '8080',
});

export function normalizeEnvironmentTarget(input = {}) {
  const gatewayHost = normalizeGatewayHost(input.gatewayHost ?? input.host ?? defaultTarget.gatewayHost);
  const gatewayPort = normalizeGatewayPort(input.gatewayPort ?? input.port ?? defaultTarget.gatewayPort);

  return {
    gatewayHost,
    gatewayPort,
  };
}

export function createIdleEnvironmentCheckState(options = {}) {
  const target = normalizeEnvironmentTarget(options.target);
  return {
    status: environmentCheckState.idle,
    detail: options.detail || '尚未檢測',
    checkedAt: '',
    target,
    summary: {
      status: 'idle',
      total: 0,
      available: 0,
      failed: 0,
      failedCapabilities: [],
    },
    capabilities: [],
  };
}

export function createRunningEnvironmentCheckState(options = {}) {
  const state = createIdleEnvironmentCheckState(options);
  const previousCapabilities = Array.isArray(options.previous?.capabilities) ? options.previous.capabilities : [];
  return {
    ...state,
    status: environmentCheckState.running,
    detail: '檢測中',
    capabilities: previousCapabilities,
  };
}

export function createFailureEnvironmentCheckState(message, options = {}) {
  const state = createIdleEnvironmentCheckState(options);
  return {
    ...state,
    status: environmentCheckState.failure,
    detail: message || '無法連線到環境檢測 API',
    capabilities: Array.isArray(options.previous?.capabilities) ? options.previous.capabilities : [],
  };
}

export function createEnvironmentCheckStateFromPayload(payload, options = {}) {
  const report = normalizeEnvironmentCheckPayload(payload, options.target);
  const status = report.summary.status === 'success' ? environmentCheckState.success : environmentCheckState.failure;

  return {
    ...report,
    status,
    detail:
      status === environmentCheckState.success
        ? `必要能力 ${report.summary.available}/${report.summary.total} 全部可用`
        : `缺少或不可用：${report.summary.failedCapabilities.join('、')}`,
  };
}

export function normalizeEnvironmentCheckPayload(payload = {}, fallbackTarget = {}) {
  const target = normalizeEnvironmentTarget({
    gatewayHost: payload?.target?.host ?? fallbackTarget.gatewayHost,
    gatewayPort: payload?.target?.gatewayPort ?? fallbackTarget.gatewayPort,
  });
  const capabilities = Array.isArray(payload?.capabilities) ? payload.capabilities.map(normalizeCapability) : [];
  const failedCapabilities = capabilities.filter((capability) => capability.status !== 'available').map((capability) => capability.label);

  return {
    ok: Boolean(payload?.ok),
    checkedAt: normalizeString(payload?.checkedAt),
    target,
    summary: {
      status: failedCapabilities.length === 0 && capabilities.length > 0 ? 'success' : 'failure',
      total: capabilities.length,
      available: capabilities.length - failedCapabilities.length,
      failed: failedCapabilities.length,
      failedCapabilities,
    },
    capabilities,
  };
}

export async function fetchEnvironmentCheck(options = {}) {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  if (typeof fetchImpl !== 'function') {
    throw new Error('目前環境無法使用 fetch。');
  }

  const target = normalizeEnvironmentTarget(options.target);
  const response = await fetchImpl(buildEnvironmentCheckUrl(options.apiBase, target), {
    method: 'GET',
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response?.ok) {
    let payload = null;
    try {
      payload = await response.json();
    } catch (_) {
      payload = null;
    }

    const message = payload?.error?.message || `環境檢測失敗 (${response?.status ?? 'unknown'})`;
    const error = new Error(message);
    error.code = payload?.error?.code || 'ENVIRONMENT_CHECK_HTTP_ERROR';
    error.status = response?.status ?? 0;
    throw error;
  }

  return normalizeEnvironmentCheckPayload(await response.json(), target);
}

export function buildEnvironmentCheckUrl(apiBase = defaultApiBase, target = {}) {
  const normalizedTarget = normalizeEnvironmentTarget(target);
  const normalizedBase = normalizeApiBase(apiBase);
  const query = new URLSearchParams({
    gatewayHost: normalizedTarget.gatewayHost,
    gatewayPort: normalizedTarget.gatewayPort,
  });
  return `${normalizedBase}/environment/check?${query.toString()}`;
}

export function formatEnvironmentStateLabel(status) {
  if (status === environmentCheckState.running) return '檢測中';
  if (status === environmentCheckState.success) return '檢測成功';
  if (status === environmentCheckState.failure) return '檢測失敗';
  return '尚未檢測';
}

export function formatCapabilityStatusText(capability = {}) {
  if (capability.status === 'available') {
    return capability.version ? `可用 · ${capability.version}` : '可用';
  }

  if (capability.status === 'missing') return '缺少';
  if (capability.status === 'unreachable') return '無法連線';
  return '檢測失敗';
}

function normalizeCapability(capability = {}) {
  return {
    id: normalizeString(capability.id),
    label: normalizeString(capability.label) || 'unknown',
    status: normalizeString(capability.status) || 'error',
    source: normalizeString(capability.source),
    detail: normalizeString(capability.detail),
    version: normalizeString(capability.version),
  };
}

function normalizeApiBase(value) {
  const trimmed = normalizeString(value) || defaultApiBase;
  return trimmed.replace(/\/+$/, '');
}

function normalizeGatewayHost(value) {
  const trimmed = normalizeString(value)
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .replace(/:\d+$/, '');

  return trimmed || defaultTarget.gatewayHost;
}

function normalizeGatewayPort(value) {
  const digits = normalizeString(value).replace(/[^0-9]/g, '');
  return digits || defaultTarget.gatewayPort;
}

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}
