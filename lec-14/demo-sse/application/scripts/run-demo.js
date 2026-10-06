import dotenv from 'dotenv';
import { createMcpSseClient } from '../src/mcpClient.js';
import { runLlmAgent, executeToolLoopWithMock } from '../src/llmAgent.js';
import { startSseServer } from '../../mcp-server/src/server.js';

dotenv.config();

const isMock =
  process.argv.includes('--mock') ||
  !process.env.OPENAI_API_KEY ||
  process.env.OPENAI_API_KEY === 'dummy-api-key-for-testing';

const MCP_PORT = parseInt(process.env.MCP_SERVER_PORT || '3001', 10);
const MCP_URL = process.env.MCP_SERVER_URL || `http://localhost:${MCP_PORT}/sse`;

async function main() {
  console.log('='.repeat(60));
  console.log('  MCP DEMO: SSE / HTTP TRANSPORT');
  console.log(`  Target MCP Server: ${MCP_URL}`);
  console.log(`  Mode: ${isMock ? 'SIMULATION / MOCK LLM' : 'LIVE CUSTOM OPENAI ENDPOINT'}`);
  console.log('='.repeat(60));

  let inProcessServer = null;
  let mcpClient = null;

  console.log('\n[1] Checking / Connecting to SSE MCP Server...');
  try {
    mcpClient = await createMcpSseClient(MCP_URL);
    console.log('    ✓ Connected to external SSE MCP Server successfully');
  } catch (err) {
    console.log(`    ℹ External server not detected on ${MCP_URL}, automatically starting local SSE server on port ${MCP_PORT}...`);
    inProcessServer = await startSseServer(MCP_PORT);
    mcpClient = await createMcpSseClient(MCP_URL);
    console.log('    ✓ Local SSE MCP Server started and client connected');
  }

  console.log('\n[2] Discovering registered MCP tools via client.listTools()...');
  const { tools } = await mcpClient.listTools();
  console.log(`    ✓ Discovered ${tools.length} tools:`);
  for (const t of tools) {
    console.log(`      - ${t.name.padEnd(20)} : ${t.description}`);
  }

  if (isMock) {
    console.log('\n[3] Running Demo Scenario (Mock LLM Tool Loop)...');

    // Action A: Add a todo
    console.log('\n--- Scenario A: User asks "Add a medium priority task to buy coffee" ---');
    const step1 = await executeToolLoopWithMock({
      userPrompt: 'Add a medium priority task to buy coffee',
      mockToolCall: {
        name: 'add_todo',
        arguments: {
          title: 'Buy coffee beans',
          priority: 'medium',
          dueDate: 'Tonight'
        }
      },
      mcpClient
    });
    console.log('  [MCP Tool Call Result]:', JSON.stringify(step1.toolCallsExecuted[0].result, null, 2));
    console.log('  [Assistant Response  ]:', step1.humanMessage);

    // Action B: List todos
    console.log('\n--- Scenario B: User asks "List all tasks" ---');
    const step2 = await executeToolLoopWithMock({
      userPrompt: 'List all tasks',
      mockToolCall: {
        name: 'list_todos',
        arguments: {}
      },
      mcpClient
    });
    console.log('  [MCP Tool Call Result]:', JSON.stringify(step2.toolCallsExecuted[0].result, null, 2));
    console.log('  [Assistant Response  ]:', step2.humanMessage);

    // Action C: Complete task
    console.log('\n--- Scenario C: User asks "Mark task-1 as completed" ---');
    const step3 = await executeToolLoopWithMock({
      userPrompt: 'Mark task-1 as completed',
      mockToolCall: {
        name: 'complete_todo',
        arguments: { id: 'task-1' }
      },
      mcpClient
    });
    console.log('  [MCP Tool Call Result]:', JSON.stringify(step3.toolCallsExecuted[0].result, null, 2));
    console.log('  [Assistant Response  ]:', step3.humanMessage);

    // Action D: Get summary
    console.log('\n--- Scenario D: User asks "Get task summary" ---');
    const step4 = await executeToolLoopWithMock({
      userPrompt: 'Get task summary',
      mockToolCall: {
        name: 'get_todo_summary',
        arguments: {}
      },
      mcpClient
    });
    console.log('  [MCP Tool Call Result]:', JSON.stringify(step4.toolCallsExecuted[0].result, null, 2));
    console.log('  [Assistant Response  ]:', step4.humanMessage);
  } else {
    console.log('\n[3] Running Live Scenario with Custom OpenAI Endpoint...');
    console.log(`    Base URL: ${process.env.OPENAI_BASE_URL}`);
    console.log(`    Model:    ${process.env.OPENAI_MODEL}`);

    const prompt = 'Add a high priority task to prepare Lecture 14 demo notes';
    console.log(`\nUser prompt: "${prompt}"`);

    const result = await runLlmAgent({
      prompt,
      mcpClient
    });

    console.log('\n[Executed MCP Tool Calls]:');
    for (const call of result.toolCallsExecuted) {
      console.log(`  - Tool: ${call.name}`);
      console.log('    Args:', JSON.stringify(call.arguments));
      console.log('    Result:', JSON.stringify(call.result));
    }

    console.log('\n[Final LLM Response]:');
    console.log(result.humanMessage);
  }

  console.log('\n[4] Closing MCP Client session...');
  await mcpClient.close();
  if (inProcessServer) {
    await inProcessServer.close();
  }
  console.log('    ✓ Finished gracefully.\n');
  process.exit(0);
}

main().catch((err) => {
  console.error('Demo failed:', err);
  process.exit(1);
});
