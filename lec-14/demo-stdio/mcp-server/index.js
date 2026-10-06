#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createMcpServer } from './src/server.js';
import { TodoStore } from './src/todoStore.js';

async function main() {
  const store = new TodoStore();
  const server = createMcpServer(store);

  // CRITICAL for stdio transport:
  // stdout is strictly reserved for MCP JSON-RPC messages.
  // All diagnostics/logs must go to stderr.
  console.error('[mcp-server-stdio] Initializing Todo MCP Server over Stdio...');

  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error('[mcp-server-stdio] Server connected to stdio and listening for requests.');

  // Handle clean shutdown
  process.on('SIGINT', async () => {
    console.error('[mcp-server-stdio] Shutting down...');
    await server.close();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error('[mcp-server-stdio] Fatal error:', err);
  process.exit(1);
});
