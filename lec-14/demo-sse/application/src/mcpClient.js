import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';

/**
 * Creates and initializes an MCP Client connected to the MCP Server over SSE/HTTP.
 * @param {string} [serverUrl] Optional URL override (default: MCP_SERVER_URL or http://localhost:3001/sse)
 * @returns {Promise<Client>}
 */
export async function createMcpSseClient(serverUrl) {
  const targetUrl =
    serverUrl || process.env.MCP_SERVER_URL || 'http://localhost:3001/sse';

  const transport = new SSEClientTransport(new URL(targetUrl));

  const client = new Client(
    {
      name: 'demo-sse-app-client',
      version: '1.0.0'
    },
    {
      capabilities: {}
    }
  );

  await client.connect(transport);
  return client;
}
