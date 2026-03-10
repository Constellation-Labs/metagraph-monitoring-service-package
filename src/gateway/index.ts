import * as http from 'http';

const PORT = parseInt(
  process.env.GATEWAY_PORT || process.env.API_PORT || '3001',
  10,
);
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';

interface BackendMap {
  [metagraph: string]: string;
}

function parseBackends(): BackendMap {
  const raw = process.env.METAGRAPH_BACKENDS || '';
  const map: BackendMap = {};
  for (const entry of raw.split(',').filter(Boolean)) {
    const eq = entry.indexOf('=');
    if (eq > 0) {
      const name = entry.slice(0, eq).trim();
      const url = entry.slice(eq + 1).trim();
      map[name] = url;
    }
  }
  return map;
}

const backends = parseBackends();

function setCorsHeaders(
  req: http.IncomingMessage,
  res: http.ServerResponse,
): void {
  if (CORS_ORIGIN === '*') {
    res.setHeader('Access-Control-Allow-Origin', '*');
  } else {
    const reqOrigin = req.headers.origin;
    if (reqOrigin) {
      try {
        const allowed = new URL(CORS_ORIGIN);
        const incoming = new URL(reqOrigin);
        if (
          allowed.hostname === incoming.hostname ||
          allowed.hostname === 'localhost'
        ) {
          res.setHeader('Access-Control-Allow-Origin', reqOrigin);
        } else {
          res.setHeader('Access-Control-Allow-Origin', CORS_ORIGIN);
        }
      } catch {
        res.setHeader('Access-Control-Allow-Origin', CORS_ORIGIN);
      }
    } else {
      res.setHeader('Access-Control-Allow-Origin', CORS_ORIGIN);
    }
  }
  res.setHeader(
    'Access-Control-Allow-Methods',
    'GET,HEAD,PUT,PATCH,POST,DELETE',
  );
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
}

function sendJson(
  res: http.ServerResponse,
  status: number,
  data: unknown,
): void {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function proxyRequest(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  targetBase: string,
): void {
  const target = new URL(req.url || '/', targetBase);

  const headers: http.OutgoingHttpHeaders = {};
  for (const [key, value] of Object.entries(req.headers)) {
    if (key.toLowerCase() !== 'host') {
      headers[key] = value;
    }
  }
  headers['host'] = target.host;

  const options: http.RequestOptions = {
    hostname: target.hostname,
    port: target.port || 80,
    path: target.pathname + target.search,
    method: req.method,
    headers,
  };

  const proxyReq = http.request(options, (proxyRes) => {
    const resHeaders: http.OutgoingHttpHeaders = {};
    for (const [key, value] of Object.entries(proxyRes.headers)) {
      resHeaders[key] = value;
    }
    const reqOrigin = req.headers.origin;
    if (CORS_ORIGIN === '*') {
      resHeaders['access-control-allow-origin'] = '*';
    } else if (reqOrigin) {
      resHeaders['access-control-allow-origin'] = reqOrigin;
    } else {
      resHeaders['access-control-allow-origin'] = CORS_ORIGIN;
    }
    resHeaders['access-control-allow-credentials'] = 'true';

    res.writeHead(proxyRes.statusCode || 502, resHeaders);
    proxyRes.pipe(res, { end: true });
  });

  proxyReq.on('error', (err) => {
    if (!res.headersSent) {
      sendJson(res, 502, {
        error: 'Backend unavailable',
        message: err.message,
      });
    }
  });

  req.pipe(proxyReq, { end: true });
}

async function aggregateMetagraphs(authHeader?: string): Promise<unknown[]> {
  const results: unknown[] = [];

  const headers: Record<string, string> = {};
  if (authHeader) {
    headers['Authorization'] = authHeader;
  }

  const promises = Object.entries(backends).map(async ([name, baseUrl]) => {
    try {
      const resp = await fetch(`${baseUrl}/api/metagraphs`, {
        headers,
        signal: AbortSignal.timeout(5000),
      });
      if (resp.ok) {
        return (await resp.json()) as unknown[];
      }
      return [{ name, health: 'unreachable', nodeCount: 0 }];
    } catch {
      return [{ name, health: 'unreachable', nodeCount: 0 }];
    }
  });

  const allResults = await Promise.all(promises);
  for (const arr of allResults) {
    results.push(...arr);
  }
  return results;
}

const server = http.createServer(async (req, res) => {
  const urlPath = req.url || '/';
  const pathname = urlPath.split('?')[0];

  setCorsHeaders(req, res);

  // Preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // GET /api/metagraphs — aggregate from all backends
  if (pathname === '/api/metagraphs' && req.method === 'GET') {
    try {
      const metagraphs = await aggregateMetagraphs(req.headers.authorization);
      sendJson(res, 200, metagraphs);
    } catch {
      sendJson(res, 500, { error: 'Failed to aggregate metagraphs' });
    }
    return;
  }

  // /api/metagraphs/:metagraph/* — proxy to specific backend
  const metagraphMatch = pathname.match(/^\/api\/metagraphs\/([^/]+)(\/.*)?$/);
  if (metagraphMatch) {
    const metagraph = metagraphMatch[1];
    const backend = backends[metagraph];
    if (!backend) {
      sendJson(res, 404, { error: `Metagraph '${metagraph}' not found` });
      return;
    }
    proxyRequest(req, res, backend);
    return;
  }

  // /api/auth/* — proxy to the first available backend
  if (pathname.startsWith('/api/auth')) {
    const firstBackend = Object.values(backends)[0];
    if (!firstBackend) {
      sendJson(res, 503, { error: 'No backends configured' });
      return;
    }
    proxyRequest(req, res, firstBackend);
    return;
  }

  // /api/health — gateway health
  if (pathname === '/api/health') {
    const metagraphList = Object.entries(backends).map(([name, url]) => ({
      name,
      url,
    }));
    sendJson(res, 200, {
      status: 'ok',
      type: 'gateway',
      metagraphs: metagraphList,
      timestamp: new Date().toISOString(),
    });
    return;
  }

  // Fallback
  sendJson(res, 404, { error: 'Not found' });
});

server.listen(PORT, () => {
  const metagraphNames = Object.keys(backends);
  console.log(`Gateway running on http://localhost:${PORT}`);
  console.log(
    `Routing ${metagraphNames.length} metagraph(s): ${metagraphNames.join(', ')}`,
  );
  for (const [name, url] of Object.entries(backends)) {
    console.log(`  ${name} → ${url}`);
  }
});
