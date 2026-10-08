// Zero-dependency Node backend: serves /public and stores each person's data in data/db.json
const http = require('http'), fs = require('fs'), path = require('path');
const PORT = process.env.PORT || 3000;
const PUB = path.join(__dirname, 'public'), DB = path.join(__dirname, 'data', 'db.json');
fs.mkdirSync(path.dirname(DB), { recursive: true });
const load = () => { try { return JSON.parse(fs.readFileSync(DB, 'utf8')); } catch { return {}; } };
const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript' };
const json = (res, code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); };

http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  const m = u.pathname.match(/^\/api\/profile\/([^/]+)$/);
  if (m) {
    const key = decodeURIComponent(m[1]).trim().toLowerCase().slice(0, 60);
    if (req.method === 'GET') { const d = load()[key]; return json(res, d ? 200 : 404, d || { error: 'not found' }); }
    if (req.method === 'PUT') {
      let b = '';
      req.on('data', c => { b += c; if (b.length > 1e6) req.destroy(); });
      req.on('end', () => {
        try { const db = load(); db[key] = JSON.parse(b); fs.writeFileSync(DB, JSON.stringify(db, null, 2)); json(res, 200, {}); }
        catch { json(res, 400, { error: 'bad data' }); }
      });
      return;
    }
  }
  const f = path.normalize(path.join(PUB, u.pathname === '/' ? 'index.html' : u.pathname));
  if (!f.startsWith(PUB) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('Not found'); }
  res.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
}).listen(PORT, () => console.log('Earn It running at http://localhost:' + PORT));
