import express from 'express';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ErrorCode,
  McpError
} from '@modelcontextprotocol/sdk/types.js';
import { TodoStore } from './todoStore.js';

export function createMcpServer(store = new TodoStore()) {
  const server = new Server(
    {
      name: 'todo-mcp-server-sse',
      version: '1.0.0'
    },
    {
      capabilities: {
        tools: {}
      }
    }
  );

  const TOOLS = [
    {
      name: 'add_todo',
      description: 'Add a new task to the todo list with optional description, priority, and due date.',
      inputSchema: {
        type: 'object',
        properties: {
          title: {
            type: 'string',
            description: 'Short title or description of the task'
          },
          description: {
            type: 'string',
            description: 'Optional additional context or notes'
          },
          priority: {
            type: 'string',
            enum: ['low', 'medium', 'high'],
            description: 'Priority level (default: medium)'
          },
          dueDate: {
            type: 'string',
            description: 'Optional due date or deadline string'
          }
        },
        required: ['title']
      }
    },
    {
      name: 'list_todos',
      description: 'List current tasks in the todo list, optionally filtered by status or priority.',
      inputSchema: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: ['all', 'pending', 'completed'],
            description: 'Filter by task status'
          },
          priority: {
            type: 'string',
            enum: ['low', 'medium', 'high'],
            description: 'Filter by priority level'
          }
        }
      }
    },
    {
      name: 'complete_todo',
      description: 'Mark an existing task as completed using its task ID.',
      inputSchema: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'The unique ID of the task to complete'
          }
        },
        required: ['id']
      }
    },
    {
      name: 'delete_todo',
      description: 'Delete a task from the todo list by its ID.',
      inputSchema: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'The unique ID of the task to delete'
          }
        },
        required: ['id']
      }
    },
    {
      name: 'get_todo_summary',
      description: 'Get aggregate summary statistics about all todos.',
      inputSchema: {
        type: 'object',
        properties: {}
      }
    }
  ];

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools: TOOLS };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args = {} } = request.params;

    try {
      switch (name) {
        case 'add_todo': {
          const item = store.add(args);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    success: true,
                    message: `Todo item created successfully with ID ${item.id}`,
                    todo: item
                  },
                  null,
                  2
                )
              }
            ]
          };
        }

        case 'list_todos': {
          const items = store.list(args);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    success: true,
                    count: items.length,
                    todos: items
                  },
                  null,
                  2
                )
              }
            ]
          };
        }

        case 'complete_todo': {
          const item = store.complete(args.id);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    success: true,
                    message: `Todo item ${item.id} marked as completed.`,
                    todo: item
                  },
                  null,
                  2
                )
              }
            ]
          };
        }

        case 'delete_todo': {
          const item = store.delete(args.id);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    success: true,
                    message: `Todo item ${item.id} deleted.`,
                    deleted: item
                  },
                  null,
                  2
                )
              }
            ]
          };
        }

        case 'get_todo_summary': {
          const summary = store.summary();
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({ success: true, summary }, null, 2)
              }
            ]
          };
        }

        default:
          throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: '${name}'`);
      }
    } catch (err) {
      return {
        isError: true,
        content: [
          {
            type: 'text',
            text: JSON.stringify({ success: false, error: err.message }, null, 2)
          }
        ]
      };
    }
  });

  return server;
}

/**
 * Creates the Express app hosting SSEServerTransport endpoints.
 */
export function createApp(store = new TodoStore()) {
  const app = express();

  // Map active sessions: sessionId -> { transport, server }
  const sessions = new Map();

  // Health endpoint
  app.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      transport: 'sse',
      activeSessions: sessions.size
    });
  });

  // SSE stream endpoint
  app.get('/sse', async (req, res) => {
    console.log('[mcp-server-sse] New SSE connection established.');
    const transport = new SSEServerTransport('/messages', res);
    const server = createMcpServer(store);

    sessions.set(transport.sessionId, { transport, server });

    res.on('close', () => {
      console.log(`[mcp-server-sse] SSE connection closed for session: ${transport.sessionId}`);
      sessions.delete(transport.sessionId);
    });

    await server.connect(transport);
  });

  // Client messages endpoint (JSON-RPC requests sent via HTTP POST)
  app.post('/messages', async (req, res) => {
    const sessionId = req.query.sessionId;
    const session = sessions.get(sessionId);

    if (!session) {
      return res.status(404).json({ error: `Session '${sessionId}' not found.` });
    }

    await session.transport.handlePostMessage(req, res);
  });

  return { app, store, sessions };
}

/**
 * Boots the HTTP server.
 */
export async function startSseServer(port = 3001, store) {
  const { app, sessions, store: activeStore } = createApp(store);

  const httpServer = await new Promise((resolve) => {
    const s = app.listen(port, () => {
      console.log(`[mcp-server-sse] HTTP Server listening on http://localhost:${port}`);
      resolve(s);
    });
  });

  return {
    app,
    sessions,
    store: activeStore,
    httpServer,
    close: async () => {
      for (const s of sessions.values()) {
        try {
          await s.server.close();
          await s.transport.close();
        } catch {}
      }
      sessions.clear();
      httpServer.closeAllConnections?.();
      await new Promise((resolve) => httpServer.close(resolve));
    }
  };
}
