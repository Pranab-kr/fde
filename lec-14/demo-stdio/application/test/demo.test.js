import test from 'node:test';
import assert from 'node:assert/strict';
import { createMcpStdioClient } from '../src/mcpClient.js';
import { convertMcpToolsToOpenAi, executeToolLoopWithMock } from '../src/llmAgent.js';
import { startServer } from '../src/server.js';

test('demo-stdio integration test', async (t) => {
  let mcpClient;

  t.before(async () => {
    mcpClient = await createMcpStdioClient();
  });

  t.after(async () => {
    if (mcpClient) {
      await mcpClient.close();
    }
  });

  await t.test('mcpClient connects over stdio and lists tools', async () => {
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
    assert.ok(addTool.function.parameters.properties.title);
  });

  await t.test('mock execution loop executes tool and returns human message', async () => {
    const result = await executeToolLoopWithMock({
      userPrompt: 'Add a high priority task to review PR #101 due at 4 PM',
      mockToolCall: {
        name: 'add_todo',
        arguments: {
          title: 'Review PR #101',
          priority: 'high',
          dueDate: 'Today 4 PM'
        }
      },
      mcpClient
    });

    assert.ok(result.humanMessage);
    assert.equal(result.toolCallsExecuted.length, 1);
    assert.equal(result.toolCallsExecuted[0].name, 'add_todo');
    assert.equal(result.toolCallsExecuted[0].result.success, true);
    assert.equal(result.toolCallsExecuted[0].result.todo.title, 'Review PR #101');
  });

  await t.test('Express server HTTP endpoints', async (sub) => {
    const testPort = 3099;
    const { serverInstance, mcpClient: appMcpClient } = await startServer(testPort);

    sub.after(async () => {
      await appMcpClient.close();
      await new Promise((resolve) => serverInstance.close(resolve));
    });

    // 1. Health endpoint
    const healthRes = await fetch(`http://localhost:${testPort}/health`);
    assert.equal(healthRes.status, 200);
    const healthJson = await healthRes.json();
    assert.equal(healthJson.status, 'ok');
    assert.equal(healthJson.transport, 'stdio');

    // 2. Discover tools
    const toolsRes = await fetch(`http://localhost:${testPort}/api/tools`);
    assert.equal(toolsRes.status, 200);
    const toolsJson = await toolsRes.json();
    assert.equal(toolsJson.tools.length, 5);

    // 3. Post chat with mock execution
    const chatRes = await fetch(`http://localhost:${testPort}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'Create task for testing Express',
        mock: true,
        mockToolCall: {
          name: 'add_todo',
          arguments: { title: 'Test Express' }
        }
      })
    });
    assert.equal(chatRes.status, 200);
    const chatJson = await chatRes.json();
    assert.equal(chatJson.success, true);
    assert.match(chatJson.humanMessage, /Test Express/);

    // 4. Get todos endpoint
    const todosRes = await fetch(`http://localhost:${testPort}/api/todos`);
    assert.equal(todosRes.status, 200);
    const todosJson = await todosRes.json();
    assert.ok(todosJson.count >= 1);
  });
});
