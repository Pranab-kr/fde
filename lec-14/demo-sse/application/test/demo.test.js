import test from 'node:test';
import assert from 'node:assert/strict';
import { startSseServer } from '../../mcp-server/src/server.js';
import { createMcpSseClient } from '../src/mcpClient.js';
import { convertMcpToolsToOpenAi, executeToolLoopWithMock } from '../src/llmAgent.js';
import { startServer } from '../src/server.js';

test('demo-sse integration test', async (t) => {
  const mcpServerPort = 3298;
  const appPort = 3299;
  let mcpServerHandle;
  let mcpClient;
  let appHandle;

  t.before(async () => {
    // 1. Start SSE MCP server
    mcpServerHandle = await startSseServer(mcpServerPort);

    // 2. Connect standalone MCP client
    mcpClient = await createMcpSseClient(`http://localhost:${mcpServerPort}/sse`);

    // 3. Start Express app pointing to SSE server
    appHandle = await startServer({
      port: appPort,
      mcpUrl: `http://localhost:${mcpServerPort}/sse`
    });
  });

  t.after(async () => {
    if (appHandle?.mcpClient) {
      await appHandle.mcpClient.close();
    }
    if (appHandle?.serverInstance) {
      await new Promise((resolve) => appHandle.serverInstance.close(resolve));
    }
    if (mcpClient) {
      await mcpClient.close();
    }
    if (mcpServerHandle) {
      await mcpServerHandle.close();
    }
  });

  await t.test('mcpClient connects over SSE and lists tools', async () => {
    const { tools } = await mcpClient.listTools();
    assert.ok(Array.isArray(tools));
    assert.equal(tools.length, 5);

    const names = tools.map((t) => t.name);
    assert.ok(names.includes('add_todo'));
    assert.ok(names.includes('list_todos'));
  });

  await t.test('convertMcpToolsToOpenAi produces valid OpenAI tool definitions', async () => {
    const { tools } = await mcpClient.listTools();
    const openAiTools = convertMcpToolsToOpenAi(tools);

    assert.equal(openAiTools.length, 5);
    const addTool = openAiTools.find((t) => t.function.name === 'add_todo');
    assert.ok(addTool);
    assert.equal(addTool.type, 'function');
    assert.equal(addTool.function.parameters.type, 'object');
  });

  await t.test('mock execution loop executes tool over SSE and returns human message', async () => {
    const result = await executeToolLoopWithMock({
      userPrompt: 'Add a high priority task for SSE testing',
      mockToolCall: {
        name: 'add_todo',
        arguments: {
          title: 'Test SSE Task',
          priority: 'high'
        }
      },
      mcpClient
    });

    assert.ok(result.humanMessage);
    assert.equal(result.toolCallsExecuted.length, 1);
    assert.equal(result.toolCallsExecuted[0].result.success, true);
    assert.equal(result.toolCallsExecuted[0].result.todo.title, 'Test SSE Task');
  });

  await t.test('Express server HTTP endpoints with SSE MCP backend', async () => {
    // 1. Health check
    const healthRes = await fetch(`http://localhost:${appPort}/health`);
    assert.equal(healthRes.status, 200);
    const healthJson = await healthRes.json();
    assert.equal(healthJson.status, 'ok');
    assert.equal(healthJson.transport, 'sse');

    // 2. Discover tools
    const toolsRes = await fetch(`http://localhost:${appPort}/api/tools`);
    assert.equal(toolsRes.status, 200);
    const toolsJson = await toolsRes.json();
    assert.equal(toolsJson.tools.length, 5);

    // 3. Post chat with mock execution
    const chatRes = await fetch(`http://localhost:${appPort}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'Create task via Express over SSE',
        mock: true,
        mockToolCall: {
          name: 'add_todo',
          arguments: { title: 'Express SSE Todo' }
        }
      })
    });
    assert.equal(chatRes.status, 200);
    const chatJson = await chatRes.json();
    assert.equal(chatJson.success, true);
    assert.match(chatJson.humanMessage, /Express SSE Todo/);

    // 4. Get todos endpoint
    const todosRes = await fetch(`http://localhost:${appPort}/api/todos`);
    assert.equal(todosRes.status, 200);
    const todosJson = await todosRes.json();
    assert.ok(todosJson.count >= 1);
  });
});
