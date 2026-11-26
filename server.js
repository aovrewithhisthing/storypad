const http = require('http');
const fs = require('fs');
const path = require('path');

function loadDotEnv(envPath) {
  const env = {};
  if (!fs.existsSync(envPath)) return env;
  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
    const idx = trimmed.indexOf('=');
    const key = trimmed.slice(0, idx).trim();
    let val = trimmed.slice(idx + 1).trim();
    if (
      val.length >= 2 &&
      ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'")))
    ) {
      val = val.slice(1, -1);
    }
    if (key) env[key] = val;
  }
  return env;
}

const dotEnv = loadDotEnv(path.join(__dirname, '.env'));
const getEnv = (key, fallback = '') => process.env[key] || dotEnv[key] || fallback;

const PORT = Number(getEnv('PORT', '3000')) || 3000;
const ROOT_DIR = path.resolve(__dirname);

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp'
};

const ALLOWED_STATIC_EXTS = new Set(Object.keys(MIME_TYPES));
const BLOCKED_PATH_PREFIXES = ['/api/', '/config/', '/includes/', '/lib/', '/supabase/', '/views/', '/docs/', '/.'];

const SECURITY_HEADERS = {
  'Content-Security-Policy': [
    "default-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "script-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com https://cdn.jsdelivr.net",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob: https:",
    "media-src 'self' blob: https:",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co"
  ].join('; '),
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Frame-Options': 'DENY',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Cross-Origin-Opener-Policy': 'same-origin'
};

function buildBootScript() {
  const boot = {
    phpEnabled: false,
    studioName: getEnv('STORYPAD_STUDIO_NAME', 'StoryPad Studio'),
    supabase: {
      url: getEnv('SUPABASE_URL', ''),
      anonKey: getEnv('SUPABASE_ANON_KEY', ''),
      projectId: getEnv('SUPABASE_PROJECT_ID', ''),
      storageBucket: getEnv('SUPABASE_STORAGE_BUCKET', 'storypad-media')
    }
  };
  const safeJson = JSON.stringify(boot).replace(/</g, '\\u003c');
  return `<script>window.STORYPAD_PHP_BOOT = Object.assign(${safeJson}, window.STORYPAD_PHP_BOOT || {});</script>`;
}

const server = http.createServer((req, res) => {
  let reqPath;
  try {
    reqPath = decodeURIComponent((req.url || '/').split('?')[0]);
  } catch (_e) {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8', ...SECURITY_HEADERS });
    res.end('400 Bad Request');
    return;
  }

  if (reqPath === '/') reqPath = '/index.html';
  const lowerPath = reqPath.toLowerCase();

  if (BLOCKED_PATH_PREFIXES.some(prefix => lowerPath.startsWith(prefix)) || lowerPath.includes('..')) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8', ...SECURITY_HEADERS });
    res.end('403 Forbidden');
    return;
  }

  const normalized = path.normalize(reqPath).replace(/^([/\\])+/g, '');
  const filePath = path.resolve(ROOT_DIR, normalized);
  if (filePath !== ROOT_DIR && !filePath.startsWith(ROOT_DIR + path.sep)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8', ...SECURITY_HEADERS });
    res.end('403 Forbidden');
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  if (
    !ALLOWED_STATIC_EXTS.has(ext) ||
    path.basename(filePath).startsWith('.') ||
    lowerPath.startsWith('/test_')
  ) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8', ...SECURITY_HEADERS });
    res.end('403 Forbidden');
    return;
  }

  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8', ...SECURITY_HEADERS });
        res.end('404 Not Found');
      } else {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8', ...SECURITY_HEADERS });
        res.end('500 Internal Server Error');
      }
      return;
    }

    if (reqPath === '/index.html') {
      const html = content.toString('utf8').replace('</head>', `  ${buildBootScript()}\n</head>`);
      res.writeHead(200, { 'Content-Type': contentType, 'Cache-Control': 'no-store', ...SECURITY_HEADERS });
      res.end(html, 'utf8');
      return;
    }

    res.writeHead(200, { 'Content-Type': contentType, ...SECURITY_HEADERS });
    res.end(content);
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`StoryPad Server running at http://127.0.0.1:${PORT}/`);
});
