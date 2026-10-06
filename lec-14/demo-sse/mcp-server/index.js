#!/usr/bin/env node
import { startSseServer } from './src/server.js';

const PORT = parseInt(process.env.MCP_SERVER_PORT || '3001', 10);

async function main() {
  console.log(`[mcp-server-sse] Starting SSE MCP Server on port ${PORT}...`);
  const serverHandle = await startSseServer(PORT);

  const shutdown = async () => {
    console.log('\n[mcp-server-sse] Shutting down SSE MCP Server...');
    await serverHandle.close();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('[mcp-server-sse] Fatal error:', err);
  process.exit(1);
});
