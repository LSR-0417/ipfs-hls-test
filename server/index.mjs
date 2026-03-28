import http from 'node:http';
import { checkEnvironment, normalizeEnvironmentTarget } from './environmentCheck.mjs';

const defaultPort = 8787;
const defaultHost = '127.0.0.1';

export function createServer(options = {}) {
  const environmentChecker = options.environmentChecker ?? checkEnvironment;

  return http.createServer(async (request, response) => {
    if (!request.url) {
      writeJson(response, 400, {
        ok: false,
        error: {
          code: 'INVALID_REQUEST',
          message: '缺少 request url。',
        },
      });
      return;
    }

    const requestUrl = new URL(request.url, `http://${request.headers.host || `${defaultHost}:${defaultPort}`}`);

    if (request.method === 'OPTIONS') {
      writeJson(response, 204, null);
      return;
    }

    if (request.method === 'GET' && requestUrl.pathname === '/health') {
      writeJson(response, 200, {
        ok: true,
        service: 'environment-check-backend',
      });
      return;
    }

    if (request.method === 'GET' && requestUrl.pathname === '/api/environment/check') {
      try {
        const target = normalizeEnvironmentTarget({
          gatewayHost: requestUrl.searchParams.get('gatewayHost'),
          gatewayPort: requestUrl.searchParams.get('gatewayPort'),
        });
        const payload = await environmentChecker(target);
        writeJson(response, 200, payload);
      } catch (error) {
        const statusCode = error?.code === 'INVALID_GATEWAY_PORT' ? 400 : 500;
        writeJson(response, statusCode, {
          ok: false,
          error: {
            code: error?.code || 'ENVIRONMENT_CHECK_FAILED',
            message: error?.message || '環境檢測失敗。',
          },
        });
      }
      return;
    }

    writeJson(response, 404, {
      ok: false,
      error: {
        code: 'NOT_FOUND',
        message: '找不到對應 API。',
      },
    });
  });
}

export function startServer(options = {}) {
  const port = Number.parseInt(process.env.ENV_CHECK_PORT || '', 10) || defaultPort;
  const host = process.env.ENV_CHECK_HOST || defaultHost;
  const server = createServer(options);

  server.listen(port, host, () => {
    console.log(`environment check backend listening on http://${host}:${port}`);
  });

  return server;
}

function writeJson(response, statusCode, payload) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Accept',
    'Cache-Control': 'no-store',
    Vary: 'Origin',
  };

  if (payload == null) {
    response.writeHead(statusCode, headers);
    response.end();
    return;
  }

  response.writeHead(statusCode, {
    ...headers,
    'Content-Type': 'application/json; charset=utf-8',
  });
  response.end(`${JSON.stringify(payload, null, 2)}\n`);
}

if (process.argv[1] && import.meta.url === new URL(process.argv[1], 'file:').href) {
  startServer();
}
