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
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml'
};

function buildBootScript() {
  const boot = {
    phpEnabled: false,
    studioName: getEnv('STORYPAD_STUDIO_NAME', 'Kelompok 10'),
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
  let reqPath = (req.url || '/').split('?')[0];
  if (reqPath === '/') reqPath = '/index.html';

  const normalized = path.normalize(reqPath).replace(/^(\.\.[/\\])+/, '');
  const filePath = path.join(__dirname, normalized);
  if (!filePath.startsWith(__dirname) || path.basename(filePath).startsWith('.')) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('403 Forbidden');
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('404 Not Found');
      } else {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('500 Server Error: ' + err.code);
      }
      return;
    }

    if (reqPath === '/index.html') {
      const html = content.toString('utf8').replace('</head>', `  ${buildBootScript()}\n</head>`);
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(html, 'utf8');
      return;
    }

    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`StoryPad Server running at http://127.0.0.1:${PORT}/`);
});
