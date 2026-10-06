import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * Creates and initializes an MCP Client connected to the MCP Server over Stdio.
 * @param {string} [serverScriptPath] Optional override for path to mcp-server index.js
 * @returns {Promise<Client>}
 */
export async function createMcpStdioClient(serverScriptPath) {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const targetScript =
    serverScriptPath || path.resolve(__dirname, '../../mcp-server/index.js');

  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [targetScript]
  });

  const client = new Client(
    {
      name: 'demo-stdio-app-client',
      version: '1.0.0'
    },
    {
      capabilities: {}
    }
  );

  await client.connect(transport);
  return client;
}
