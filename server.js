/**
 * 绿色社会工作视角下高校群体环境意识与绿色实践参与 —— 问卷系统后端
 * 无任何第三方依赖，仅使用 Node.js 内置模块。
 * 本地运行：node server.js
 * 部署到 Render/Glitch/Railway 等免费平台：启动命令为 `node server.js`
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const PORT = process.env.PORT || 3000;
// 后台数据访问口令：部署前请务必修改为你自己的口令
const ADMIN_KEY = process.env.ADMIN_KEY || 'lvmei2026';

const DATA_FILE = path.join(__dirname, 'data.json');
const MAX_BODY = 1024 * 1024; // 单次提交上限 1MB

function readData() {
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch (e) {
    return [];
  }
}

function writeData(arr) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(arr, null, 2), 'utf8');
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8'
};

function send(res, status, body, type) {
  const headers = {
    'Content-Type': type || 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };
  res.writeHead(status, headers);
  res.end(body);
}

function serveStatic(res, pathname) {
  let rel = decodeURIComponent(pathname);
  if (rel === '/') rel = '/index.html';
  if (rel === '/admin' || rel === '/admin.html') rel = '/admin.html';
  const root = __dirname;
  const abs = path.normalize(path.join(root, rel));
  if (!abs.startsWith(root + path.sep) && abs !== root) {
    return send(res, 403, 'Forbidden', 'text/plain; charset=utf-8');
  }
  fs.readFile(abs, (err, data) => {
    if (err) {
      return send(res, 404, 'Not Found: ' + rel, 'text/plain; charset=utf-8');
    }
    const ext = path.extname(abs).toLowerCase();
    send(res, 200, data, MIME[ext] || 'application/octet-stream');
  });
}

const server = http.createServer((req, res) => {
  if (req.method === 'OPTIONS') {
    return send(res, 204, '');
  }

  const url = new URL(req.url, 'http://localhost');
  const pathname = url.pathname;

  // 查询所有答卷（需口令）
  if (req.method === 'GET' && pathname === '/api/records') {
    const key = url.searchParams.get('key');
    if (key !== ADMIN_KEY) {
      return send(res, 401, JSON.stringify({ error: 'unauthorized' }));
    }
    return send(res, 200, JSON.stringify(readData()));
  }

  // 提交答卷
  if (req.method === 'POST' && pathname === '/api/records') {
    let body = '';
    req.on('data', (c) => {
      body += c;
      if (body.length > MAX_BODY) {
        req.destroy();
      }
    });
    req.on('end', () => {
      if (!body) {
        return send(res, 400, JSON.stringify({ error: 'empty body' }));
      }
      try {
        const rec = JSON.parse(body);
        const data = readData();
        const id = 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

        // 服务器端复核算术质检题
        const a = Number(rec.check && rec.check.a);
        const b = Number(rec.check && rec.check.b);
        const ans = Number(rec.check && rec.check.ans);
        const checkPass = Number.isFinite(a) && Number.isFinite(b) && Number.isFinite(ans) && a + b === ans;

        const newRec = Object.assign({}, rec, {
          id,
          submittedAt: new Date().toISOString(),
          checkPass: !!checkPass
        });
        data.push(newRec);
        writeData(data);
        return send(res, 201, JSON.stringify({ ok: true, id, checkPass: newRec.checkPass }));
      } catch (e) {
        return send(res, 400, JSON.stringify({ error: 'bad request' }));
      }
    });
    return;
  }

  // 静态文件
  if (req.method === 'GET') {
    return serveStatic(res, pathname);
  }

  return send(res, 405, JSON.stringify({ error: 'method not allowed' }));
});

server.listen(PORT, () => {
  console.log('问卷系统已启动: http://localhost:' + PORT);
  console.log('后台地址: http://localhost:' + PORT + '/admin');
});