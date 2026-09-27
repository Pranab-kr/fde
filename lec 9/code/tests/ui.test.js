import fs from 'fs';
import path from 'path';
import assert from 'assert';
import http from 'http';
import { fileURLToPath } from 'url';
import app from '../src/server.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function get(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, data }));
    }).on('error', reject);
  });
}

async function testUIFiles() {
  const publicDir = path.join(__dirname, '../public');
  assert.ok(fs.existsSync(path.join(publicDir, 'index.html')), 'index.html should exist');
  assert.ok(fs.existsSync(path.join(publicDir, 'style.css')), 'style.css should exist');
  assert.ok(fs.existsSync(path.join(publicDir, 'app.js')), 'app.js should exist');

  const html = fs.readFileSync(path.join(publicDir, 'index.html'), 'utf8');
  assert.ok(html.includes('MIKU'), 'HTML should feature MIKU');
  assert.ok(html.includes('id="chat-box"'), 'HTML should have chat-box container');
  assert.ok(html.includes('id="chat-form"'), 'HTML should have chat-form');
  assert.ok(html.includes('id="query-input"'), 'HTML should have query-input');
  assert.ok(html.includes('id="system-stats"'), 'HTML should have system-stats');

  const css = fs.readFileSync(path.join(publicDir, 'style.css'), 'utf8');
  assert.ok(css.includes('--primary'), 'CSS should define theme variables');
  assert.ok(css.includes('.rag-drawer'), 'CSS should include rag-drawer styling');
  assert.ok(css.includes('.bubble'), 'CSS should include bubble styling');

  const js = fs.readFileSync(path.join(publicDir, 'app.js'), 'utf8');
  assert.ok(js.includes('/api/query'), 'JS should call /api/query');
  assert.ok(js.includes('/api/health'), 'JS should call /api/health');
  assert.ok(js.includes('appendMessage'), 'JS should have appendMessage');
  assert.ok(js.includes('appendTypingIndicator'), 'JS should have typing indicator');

  // Verify static serving via Express
  const server = app.listen(0);
  await new Promise(resolve => server.once('listening', resolve));
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}`;

  try {
    const rootRes = await get(`${baseUrl}/`);
    assert.strictEqual(rootRes.status, 200, 'GET / should return status 200');
    assert.ok(rootRes.data.includes('MIKU - E-Commerce Policy Support'), 'GET / should serve index.html');

    const cssRes = await get(`${baseUrl}/style.css`);
    assert.strictEqual(cssRes.status, 200, 'GET /style.css should return status 200');
    assert.ok(cssRes.data.includes('--primary'), 'GET /style.css should return style.css');

    const jsRes = await get(`${baseUrl}/app.js`);
    assert.strictEqual(jsRes.status, 200, 'GET /app.js should return status 200');
    assert.ok(jsRes.data.includes('/api/query'), 'GET /app.js should return app.js');
  } finally {
    await new Promise(resolve => server.close(resolve));
  }

  console.log('Task 7 UI files verified');
}

testUIFiles().catch(err => {
  console.error('Task 7 UI test failed:', err);
  process.exit(1);
});
