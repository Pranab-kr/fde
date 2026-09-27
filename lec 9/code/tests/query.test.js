import assert from 'assert';
import http from 'http';
import net from 'net';

const PORT = parseInt(process.env.PORT, 10) || 3000;
const BASE_URL = `http://localhost:${PORT}`;

function isPortActive(port) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(500);
    socket.on('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.on('error', () => {
      socket.destroy();
      resolve(false);
    });
    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.connect(port, '127.0.0.1');
  });
}

function getJson(url) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = http.request({
      hostname: u.hostname,
      port: u.port,
      path: u.pathname,
      method: 'GET',
    }, res => {
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

function postJson(url, data) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(data);
    const u = new URL(url);
    const req = http.request({
      hostname: u.hostname,
      port: u.port,
      path: u.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    }, res => {
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function run() {
  let server = null;

  // Check if server is already running on port
  const active = await isPortActive(PORT);
  if (!active) {
    try {
      const serverModule = await import('../src/server.js');
      const app = serverModule.default || serverModule.app;
      if (app) {
        server = app.listen(PORT);
        await new Promise((resolve, reject) => {
          server.once('listening', resolve);
          server.once('error', reject);
        });
      }
    } catch (err) {
      if (err.code !== 'ERR_MODULE_NOT_FOUND') {
        throw err;
      }
    }
  }

  try {
    console.log('Testing in-scope question (Returns)...');
    const res1 = await postJson(`${BASE_URL}/api/query`, {
      question: 'How many days do I have to return an item?'
    });
    assert.strictEqual(res1.status, 200, `Expected status 200, got ${res1.status}`);
    assert.strictEqual(res1.data.agent, 'MIKU', 'Expected agent MIKU');
    assert.ok(res1.data.answer.includes('30'), 'Answer should mention 30 days');
    assert.ok(Array.isArray(res1.data.sources) && res1.data.sources.length > 0, 'Sources should be returned');

    console.log('Testing out-of-scope question (Recipe rejection)...');
    const res2 = await postJson(`${BASE_URL}/api/query`, {
      question: 'How do I bake a chocolate cake at home?'
    });
    assert.strictEqual(res2.status, 200, `Expected status 200, got ${res2.status}`);
    assert.ok(
      res2.data.answer.toLowerCase().includes("don't have the information") ||
      res2.data.answer.toLowerCase().includes("store policies"),
      'Should politely reject out-of-scope question'
    );
    assert.ok(Array.isArray(res2.data.sources), 'Sources array should be returned');

    console.log('Testing 400 empty question...');
    const res3 = await postJson(`${BASE_URL}/api/query`, { question: '   ' });
    assert.strictEqual(res3.status, 400, `Expected status 400 for empty query, got ${res3.status}`);

    console.log('Testing GET /api/health...');
    const health = await getJson(`${BASE_URL}/api/health`);
    assert.strictEqual(health.status, 200, `Expected status 200 for health endpoint, got ${health.status}`);
    assert.strictEqual(health.data.status, 'ok');
    assert.strictEqual(health.data.agent, 'MIKU');

    console.log('Task 6 query integration tests passed');
  } finally {
    if (server) {
      await new Promise(resolve => server.close(resolve));
    }
  }
}

run().catch(err => {
  console.error('Query test failed:', err);
  process.exit(1);
});
