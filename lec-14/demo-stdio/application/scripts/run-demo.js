import dotenv from 'dotenv';
import { createMcpStdioClient } from '../src/mcpClient.js';
import { runLlmAgent, executeToolLoopWithMock } from '../src/llmAgent.js';

dotenv.config();

const isMock =
  process.argv.includes('--mock') ||
  !process.env.OPENAI_API_KEY ||
  process.env.OPENAI_API_KEY === 'dummy-api-key-for-testing';

async function main() {
  console.log('='.repeat(60));
  console.log('  MCP DEMO: STDIO TRANSPORT');
  console.log(`  Mode: ${isMock ? 'SIMULATION / MOCK LLM' : 'LIVE CUSTOM OPENAI ENDPOINT'}`);
  console.log('='.repeat(60));

  console.log('\n[1] Spawning MCP Server over Stdio and connecting MCP Client...');
  const mcpClient = await createMcpStdioClient();
  console.log('    ✓ Connected to MCP Server via stdio child process');

  console.log('\n[2] Discovering registered MCP tools via client.listTools()...');
  const { tools } = await mcpClient.listTools();
  console.log(`    ✓ Discovered ${tools.length} tools:`);
  for (const t of tools) {
    console.log(`      - ${t.name.padEnd(20)} : ${t.description}`);
  }

  if (isMock) {
    console.log('\n[3] Running Demo Scenario (Mock LLM Tool Loop)...');

    // Action A: Add a todo
    console.log('\n--- Scenario A: User asks "Add a high priority task to prepare Lecture 14 slides" ---');
    const step1 = await executeToolLoopWithMock({
      userPrompt: 'Add a high priority task to prepare Lecture 14 slides',
      mockToolCall: {
        name: 'add_todo',
        arguments: {
          title: 'Prepare Lecture 14 slides',
          priority: 'high',
          dueDate: '2026-10-07 15:00'
        }
      },
      mcpClient
    });
    console.log('  [MCP Tool Call Result]:', JSON.stringify(step1.toolCallsExecuted[0].result, null, 2));
    console.log('  [Assistant Response  ]:', step1.humanMessage);

    // Action B: List todos
    console.log('\n--- Scenario B: User asks "Show me all my tasks" ---');
    const step2 = await executeToolLoopWithMock({
      userPrompt: 'Show me all my tasks',
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
    console.log('\n--- Scenario D: User asks "Give me a summary of my tasks" ---');
    const step4 = await executeToolLoopWithMock({
      userPrompt: 'Give me a summary of my tasks',
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

    const prompt = 'Please create a high-priority todo item to write documentation for Lecture 14 due tomorrow at 5 PM.';
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

  console.log('\n[4] Closing MCP Client and stopping child process...');
  await mcpClient.close();
  console.log('    ✓ Finished gracefully.\n');
}

main().catch((err) => {
  console.error('Demo failed:', err);
  process.exit(1);
});
