import { execFile } from 'node:child_process';
import http from 'node:http';
import https from 'node:https';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const defaultCommandTimeoutMs = 4000;
const defaultHttpTimeoutMs = 4000;

export const defaultEnvironmentTarget = Object.freeze({
  gatewayHost: '127.0.0.1',
  gatewayPort: 8080,
});

export function normalizeEnvironmentTarget(input = {}) {
  const gatewayHost = normalizeGatewayHost(input.gatewayHost ?? input.host ?? defaultEnvironmentTarget.gatewayHost);
  const gatewayPort = normalizeGatewayPort(input.gatewayPort ?? input.port ?? defaultEnvironmentTarget.gatewayPort);

  return {
    gatewayHost,
    gatewayPort,
    gatewayBaseUrl: `http://${gatewayHost}:${gatewayPort}/`,
  };
}

export function buildGatewayBaseUrl(target = {}) {
  const gatewayHost = normalizeGatewayHost(target.gatewayHost ?? target.host ?? defaultEnvironmentTarget.gatewayHost);
  const gatewayPort = normalizeGatewayPort(target.gatewayPort ?? target.port ?? defaultEnvironmentTarget.gatewayPort);
  return `http://${gatewayHost}:${gatewayPort}/`;
}

export async function runCommand(command, args = [], options = {}) {
  const timeoutMs = Number.isInteger(options.timeoutMs) ? options.timeoutMs : defaultCommandTimeoutMs;
  return execFileAsync(command, args, {
    timeout: timeoutMs,
    maxBuffer: 1024 * 1024,
    windowsHide: true,
  });
}

export async function requestHttpStatus(url, options = {}) {
  const timeoutMs = Number.isInteger(options.timeoutMs) ? options.timeoutMs : defaultHttpTimeoutMs;
  const requestImpl = url.startsWith('https:') ? https.request : http.request;

  return new Promise((resolve, reject) => {
    const request = requestImpl(
      url,
      {
        method: 'GET',
        timeout: timeoutMs,
        headers: {
          Accept: 'text/plain, application/json;q=0.9, */*;q=0.1',
          'User-Agent': 'ipfs-hls-test-environment-check',
        },
      },
      (response) => {
        response.resume();
        resolve({
          statusCode: response.statusCode ?? 0,
        });
      }
    );

    request.on('timeout', () => {
      request.destroy(new Error(`request timeout after ${timeoutMs}ms`));
    });
    request.on('error', reject);
    request.end();
  });
}

export function createRuntimeCapability(processVersion = process.version) {
  return {
    id: 'nodejs',
    label: 'node.js',
    status: 'available',
    source: 'runtime',
    detail: 'Node.js 執行中',
    version: sanitizeVersion(processVersion),
  };
}

export async function checkCommandCapability(definition, dependencies = {}) {
  const commandRunner = dependencies.commandRunner ?? runCommand;
  const timeoutMs = Number.isInteger(definition.timeoutMs) ? definition.timeoutMs : defaultCommandTimeoutMs;

  try {
    const result = await commandRunner(definition.command, definition.args ?? [], { timeoutMs });
    const version = extractVersionText(result);
    return {
      id: definition.id,
      label: definition.label,
      status: 'available',
      source: 'command',
      detail: version ? `${definition.label} 可用` : `${definition.label} 可用`,
      version,
    };
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return createCapabilityFailure(definition, 'missing', `找不到 ${definition.label} 指令`);
    }

    if (error?.signal === 'SIGTERM' || error?.killed) {
      return createCapabilityFailure(definition, 'error', `${definition.label} 檢測逾時`);
    }

    const message = firstOutputLine(error?.stderr || error?.stdout || error?.message);
    return createCapabilityFailure(definition, 'error', message ? `${definition.label} 檢測失敗：${message}` : `${definition.label} 檢測失敗`);
  }
}

export async function checkGatewayCapability(target, dependencies = {}) {
  const httpRequester = dependencies.httpRequester ?? requestHttpStatus;
  const normalized = normalizeEnvironmentTarget(target);
  const gatewayUrl = normalized.gatewayBaseUrl;

  try {
    const response = await httpRequester(gatewayUrl, {
      timeoutMs: dependencies.timeoutMs,
    });
    const statusCode = Number.isInteger(response?.statusCode) ? response.statusCode : 0;

    if (statusCode >= 200 && statusCode < 500) {
      return {
        id: 'ipfsNode',
        label: 'ipfs node',
        status: 'available',
        source: 'http',
        detail: `可連線到 ${gatewayUrl} (HTTP ${statusCode})`,
        version: '',
      };
    }

    return createCapabilityFailure(
      {
        id: 'ipfsNode',
        label: 'ipfs node',
        source: 'http',
      },
      statusCode >= 500 ? 'error' : 'unreachable',
      statusCode >= 500
        ? `已連線到 ${gatewayUrl}，但 gateway 回傳 HTTP ${statusCode}`
        : `無法連線到 ${gatewayUrl} (HTTP ${statusCode || 'ERR'})`
    );
  } catch (error) {
    return createCapabilityFailure(
      {
        id: 'ipfsNode',
        label: 'ipfs node',
        source: 'http',
      },
      'unreachable',
      `無法連線到 ${gatewayUrl}${error?.message ? `：${error.message}` : ''}`
    );
  }
}

export function createEnvironmentReport(target, capabilities = []) {
  const failedCapabilities = capabilities.filter((capability) => capability.status !== 'available').map((capability) => capability.label);
  const available = capabilities.length - failedCapabilities.length;

  return {
    ok: true,
    checkedAt: new Date().toISOString(),
    target: {
      host: target.gatewayHost,
      gatewayPort: target.gatewayPort,
      gatewayBaseUrl: target.gatewayBaseUrl,
    },
    summary: {
      status: failedCapabilities.length === 0 ? 'success' : 'failure',
      total: capabilities.length,
      available,
      failed: failedCapabilities.length,
      failedCapabilities,
    },
    capabilities,
  };
}

export async function checkEnvironment(input = {}, dependencies = {}) {
  const target = normalizeEnvironmentTarget(input);
  const commandDefinitions = [
    { id: 'ffmpeg', label: 'ffmpeg', command: 'ffmpeg', args: ['-version'] },
    { id: 'ffprobe', label: 'ffprobe', command: 'ffprobe', args: ['-version'] },
    { id: 'ipfs', label: 'ipfs', command: 'ipfs', args: ['--version'] },
    { id: 'jq', label: 'jq', command: 'jq', args: ['--version'] },
  ];

  const capabilities = await Promise.all([
    Promise.resolve(createRuntimeCapability(dependencies.processVersion)),
    ...commandDefinitions.map((definition) => checkCommandCapability(definition, dependencies)),
    checkGatewayCapability(target, dependencies),
  ]);

  return createEnvironmentReport(target, capabilities);
}

function createCapabilityFailure(definition, status, detail) {
  return {
    id: definition.id,
    label: definition.label,
    status,
    source: definition.source ?? 'command',
    detail,
    version: '',
  };
}

function normalizeGatewayHost(value) {
  const normalized = String(value ?? '')
    .trim()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .replace(/:\d+$/, '');

  return normalized || defaultEnvironmentTarget.gatewayHost;
}

function normalizeGatewayPort(value) {
  const port = Number.parseInt(String(value ?? '').trim(), 10);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    const error = new Error('gatewayPort 必須是 1 到 65535 的整數。');
    error.code = 'INVALID_GATEWAY_PORT';
    throw error;
  }
  return port;
}

function extractVersionText(result = {}) {
  const output = firstOutputLine(result.stdout || result.stderr || '');
  return sanitizeVersion(output);
}

function sanitizeVersion(value) {
  return String(value ?? '').trim();
}

function firstOutputLine(value) {
  return String(value ?? '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean) || '';
}
