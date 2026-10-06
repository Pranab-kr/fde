import test from 'node:test';
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { startSseServer } from '../src/server.js';

test('SSE MCP Server over HTTP transport', async (t) => {
  const testPort = 3199;
  let serverHandle;
  let client;

  t.before(async () => {
    serverHandle = await startSseServer(testPort);
    client = new Client({ name: 'test-sse-client', version: '1.0.0' }, { capabilities: {} });
    const transport = new SSEClientTransport(new URL(`http://localhost:${testPort}/sse`));
    await client.connect(transport);
  });

  t.after(async () => {
    if (client) {
      await client.close();
    }
    if (serverHandle) {
      await serverHandle.close();
    }
  });

  await t.test('discovers all 5 tools over SSE', async () => {
    const { tools } = await client.listTools();
    assert.equal(tools.length, 5);
    const names = tools.map((t) => t.name);
    assert.ok(names.includes('add_todo'));
    assert.ok(names.includes('list_todos'));
  });

  await t.test('calls add_todo and list_todos over SSE', async () => {
    const addRes = await client.callTool({
      name: 'add_todo',
      arguments: {
        title: 'Learn SSE Transport with MCP',
        priority: 'high'
      }
    });

    const parsedAdd = JSON.parse(addRes.content[0].text);
    assert.equal(parsedAdd.success, true);
    assert.equal(parsedAdd.todo.title, 'Learn SSE Transport with MCP');

    const listRes = await client.callTool({
      name: 'list_todos',
      arguments: {}
    });

    const parsedList = JSON.parse(listRes.content[0].text);
    assert.equal(parsedList.success, true);
    assert.equal(parsedList.count, 1);
  });
});
