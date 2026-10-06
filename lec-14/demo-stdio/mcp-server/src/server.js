import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ErrorCode,
  McpError
} from '@modelcontextprotocol/sdk/types.js';
import { TodoStore } from './todoStore.js';

/**
 * Creates and configures the MCP Server with Todo tools.
 * @param {TodoStore} [store]
 * @returns {Server}
 */
export function createMcpServer(store = new TodoStore()) {
  const server = new Server(
    {
      name: 'todo-mcp-server',
      version: '1.0.0'
    },
    {
      capabilities: {
        tools: {}
      }
    }
  );

  // Define tools metadata conforming to MCP ListTools specification
  const TOOLS = [
    {
      name: 'add_todo',
      description: 'Add a new task to the todo list with optional description, priority, and due date.',
      inputSchema: {
        type: 'object',
        properties: {
          title: {
            type: 'string',
            description: 'Short title or description of the task to be done'
          },
          description: {
            type: 'string',
            description: 'Optional additional context or notes about the task'
          },
          priority: {
            type: 'string',
            enum: ['low', 'medium', 'high'],
            description: 'Priority level (default: medium)'
          },
          dueDate: {
            type: 'string',
            description: 'Optional due date or deadline string (e.g., 2026-10-07 17:00 or tomorrow)'
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
            description: 'Filter by task completion status (default: all)'
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
            description: 'The unique ID of the task to complete (e.g. task-1)'
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
            description: 'The unique ID of the task to delete (e.g. task-1)'
          }
        },
        required: ['id']
      }
    },
    {
      name: 'get_todo_summary',
      description: 'Get aggregate summary statistics about all todos (total, completed, pending, high priority count).',
      inputSchema: {
        type: 'object',
        properties: {}
      }
    }
  ];

  // Handler for tool discovery: client asks "what tools do you have?"
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools: TOOLS };
  });

  // Handler for tool execution: client calls a specific tool
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
                text: JSON.stringify({
                  success: true,
                  message: `Todo item created successfully with ID ${item.id}`,
                  todo: item
                }, null, 2)
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
                text: JSON.stringify({
                  success: true,
                  count: items.length,
                  todos: items
                }, null, 2)
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
                text: JSON.stringify({
                  success: true,
                  message: `Todo item ${item.id} marked as completed.`,
                  todo: item
                }, null, 2)
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
                text: JSON.stringify({
                  success: true,
                  message: `Todo item ${item.id} deleted.`,
                  deleted: item
                }, null, 2)
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
                text: JSON.stringify({
                  success: true,
                  summary
                }, null, 2)
              }
            ]
          };
        }

        default:
          throw new McpError(
            ErrorCode.MethodNotFound,
            `Unknown tool: '${name}'. Available tools are: ${TOOLS.map((t) => t.name).join(', ')}`
          );
      }
    } catch (err) {
      // In MCP, tool application errors can be gracefully returned as isError: true
      return {
        isError: true,
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: err.message
            }, null, 2)
          }
        ]
      };
    }
  });

  return server;
}
