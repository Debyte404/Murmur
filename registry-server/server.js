const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');

const checkHandler = require('./api/check');
const registerHandler = require('./api/register');
const lookupHandler = require('./api/lookup');
const peersHandler = require('./api/peers');
const heartbeatHandler = require('./api/heartbeat');
const healthHandler = require('./api/health');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

// Helper to adapt Node http req/res to Vercel-like serverless handler interface
function createVercelAdapter(handler) {
  return async (req, res, parsedUrl) => {
    // Attach query object
    req.query = Object.fromEntries(parsedUrl.searchParams);

    // Decorate res with .status() and .json()
    res.status = (code) => {
      res.statusCode = code;
      return res;
    };
    res.json = (data) => {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify(data, null, 2));
    };

    // Parse body for POST/PUT
    if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
      let bodyData = '';
      req.on('data', (chunk) => {
        bodyData += chunk;
      });
      req.on('end', async () => {
        try {
          req.body = bodyData ? JSON.parse(bodyData) : {};
        } catch {
          req.body = bodyData;
        }
        await handler(req, res);
      });
    } else {
      req.body = {};
      await handler(req, res);
    }
  };
}

const routes = {
  '/api/check': createVercelAdapter(checkHandler),
  '/api/register': createVercelAdapter(registerHandler),
  '/api/lookup': createVercelAdapter(lookupHandler),
  '/api/peers': createVercelAdapter(peersHandler),
  '/api/heartbeat': createVercelAdapter(heartbeatHandler),
  '/api/health': createVercelAdapter(healthHandler),
};

const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;

  // 1. API routes
  if (routes[pathname]) {
    return routes[pathname](req, res, parsedUrl);
  }

  // 2. Static files
  let safePath = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  let filePath = path.join(PUBLIC_DIR, safePath);

  // Prevent path traversal
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.statusCode = 403;
    return res.end('Forbidden');
  }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath).toLowerCase();
    res.setHeader('Content-Type', MIME_TYPES[ext] || 'application/octet-stream');
    return fs.createReadStream(filePath).pipe(res);
  }

  // Fallback to index.html for SPA if not found
  const fallbackIndex = path.join(PUBLIC_DIR, 'index.html');
  if (fs.existsSync(fallbackIndex)) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return fs.createReadStream(fallbackIndex).pipe(res);
  }

  res.statusCode = 404;
  res.end('Not Found');
});

server.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`⚡ Murmur P2P Registry Server running at http://localhost:${PORT}`);
  console.log(`⚡ Custom Domain Target: https://murmur.debyte.space`);
  console.log(`⚡ Protocol: rustp2p-quic/0.1.2`);
  console.log(`======================================================\n`);
});
