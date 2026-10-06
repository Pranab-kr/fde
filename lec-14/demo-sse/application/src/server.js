import express from 'express';
import dotenv from 'dotenv';
import { createMcpSseClient } from './mcpClient.js';
import { runLlmAgent, executeToolLoopWithMock } from './llmAgent.js';

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);
const MCP_URL = process.env.MCP_SERVER_URL || 'http://localhost:3001/sse';

app.use(express.json());

let mcpClient = null;

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    transport: 'sse',
    mcpConnected: Boolean(mcpClient),
    mcpServerUrl: MCP_URL
  });
});

// Discover tools available on the MCP Server
app.get('/api/tools', async (req, res) => {
  try {
    if (!mcpClient) {
      return res.status(503).json({ error: 'MCP client is not connected' });
    }
    const { tools } = await mcpClient.listTools();
    res.json({ success: true, count: tools.length, tools });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Directly list todos via MCP tool
app.get('/api/todos', async (req, res) => {
  try {
    if (!mcpClient) {
      return res.status(503).json({ error: 'MCP client is not connected' });
    }
    const status = req.query.status;
    const priority = req.query.priority;

    const result = await mcpClient.callTool({
      name: 'list_todos',
      arguments: { status, priority }
    });

    const parsed = JSON.parse(result.content[0].text);
    res.json(parsed);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Main endpoint: natural language prompt processed by LLM + MCP tools
app.post('/api/chat', async (req, res) => {
  try {
    const { message, mock = false, mockToolCall } = req.body;
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Field "message" (string) is required.' });
    }

    if (!mcpClient) {
      return res.status(503).json({ error: 'MCP client is not connected' });
    }

    if (mock) {
      const result = await executeToolLoopWithMock({
        userPrompt: message,
        mockToolCall: mockToolCall || {
          name: 'add_todo',
          arguments: { title: message, priority: 'medium' }
        },
        mcpClient
      });
      return res.json({ success: true, ...result });
    }

    const result = await runLlmAgent({
      prompt: message,
      mcpClient
    });

    res.json({
      success: true,
      humanMessage: result.humanMessage,
      toolCallsExecuted: result.toolCallsExecuted
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message,
      hint:
        'Verify OPENAI_BASE_URL, OPENAI_API_KEY, and OPENAI_MODEL in .env or run with { "mock": true } for offline testing.'
    });
  }
});

// Start Express server after connecting MCP client over SSE
export async function startServer({ port = PORT, mcpUrl = MCP_URL } = {}) {
  try {
    console.log(`[application-sse] Connecting to MCP Server via SSE at ${mcpUrl}...`);
    mcpClient = await createMcpSseClient(mcpUrl);
    console.log('[application-sse] MCP Client connected over SSE successfully.');

    const serverInstance = await new Promise((resolve) => {
      const s = app.listen(port, () => {
        console.log(`[application-sse] Express Server listening on http://localhost:${port}`);
        resolve(s);
      });
    });

    const shutdown = async () => {
      console.log('\n[application-sse] Shutting down Express server and MCP client...');
      if (mcpClient) {
        await mcpClient.close();
      }
      serverInstance.close(() => {
        process.exit(0);
      });
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

    return { app, serverInstance, mcpClient };
  } catch (err) {
    console.error('[application-sse] Failed to start server:', err);
    throw err;
  }
}

if (process.argv[1] && process.argv[1].endsWith('server.js')) {
  startServer().catch(() => process.exit(1));
}
