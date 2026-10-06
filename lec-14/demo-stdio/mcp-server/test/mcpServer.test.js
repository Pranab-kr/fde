import test from 'node:test';
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createMcpServer } from '../src/server.js';
import { TodoStore } from '../src/todoStore.js';

test('MCP Server Tools via MCP Client protocol', async (t) => {
  const store = new TodoStore();
  const server = createMcpServer(store);
  const client = new Client(
    { name: 'test-client', version: '1.0.0' },
    { capabilities: {} }
  );

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  await Promise.all([
    server.connect(serverTransport),
    client.connect(clientTransport)
  ]);

  t.after(async () => {
    await client.close();
    await server.close();
  });

  await t.test('client.listTools returns 5 todo tools', async () => {
    const result = await client.listTools();
    assert.ok(result.tools);
    assert.equal(result.tools.length, 5);

    const toolNames = result.tools.map((t) => t.name).sort();
    assert.deepEqual(toolNames, [
      'add_todo',
      'complete_todo',
      'delete_todo',
      'get_todo_summary',
      'list_todos'
    ]);
  });

  await t.test('callTool: add_todo', async () => {
    const res = await client.callTool({
      name: 'add_todo',
      arguments: {
        title: 'Review pull request',
        priority: 'high',
        dueDate: 'Tomorrow 5 PM'
      }
    });

    assert.equal(res.isError, undefined);
    assert.ok(res.content && res.content[0].type === 'text');
    const parsed = JSON.parse(res.content[0].text);
    assert.equal(parsed.success, true);
    assert.equal(parsed.todo.title, 'Review pull request');
    assert.equal(parsed.todo.priority, 'high');
  });

  await t.test('callTool: list_todos', async () => {
    const res = await client.callTool({
      name: 'list_todos',
      arguments: { status: 'pending' }
    });

    const parsed = JSON.parse(res.content[0].text);
    assert.equal(parsed.success, true);
    assert.equal(parsed.count, 1);
    assert.equal(parsed.todos[0].title, 'Review pull request');
  });

  await t.test('callTool: complete_todo', async () => {
    const res = await client.callTool({
      name: 'complete_todo',
      arguments: { id: 'task-1' }
    });

    const parsed = JSON.parse(res.content[0].text);
    assert.equal(parsed.success, true);
    assert.equal(parsed.todo.completed, true);
  });

  await t.test('callTool: get_todo_summary', async () => {
    const res = await client.callTool({
      name: 'get_todo_summary',
      arguments: {}
    });

    const parsed = JSON.parse(res.content[0].text);
    assert.equal(parsed.success, true);
    assert.equal(parsed.summary.total, 1);
    assert.equal(parsed.summary.completed, 1);
    assert.equal(parsed.summary.pending, 0);
  });

  await t.test('callTool: delete_todo', async () => {
    const res = await client.callTool({
      name: 'delete_todo',
      arguments: { id: 'task-1' }
    });

    const parsed = JSON.parse(res.content[0].text);
    assert.equal(parsed.success, true);
    assert.equal(parsed.deleted.id, 'task-1');
  });

  await t.test('callTool: handles error gracefully', async () => {
    const res = await client.callTool({
      name: 'complete_todo',
      arguments: { id: 'non-existent-task' }
    });

    assert.equal(res.isError, true);
    const parsed = JSON.parse(res.content[0].text);
    assert.equal(parsed.success, false);
    assert.match(parsed.error, /not found/i);
  });
});
