# Lecture 14: Model Context Protocol (MCP) Demo Application

This project demonstrates the complete end-to-end lifecycle of the **Model Context Protocol (MCP)** with an Express application, an OpenAI-compatible custom LLM endpoint, and an MCP Server exposing a suite of Todo tools.

To clearly showcase how MCP operates in different environments, this project provides two completely independent implementations:

| Directory | Transport | Description | Best For |
| :--- | :--- | :--- | :--- |
| [`demo-stdio/`](./demo-stdio/) | **Stdio (`stdin`/`stdout`)** | The MCP Client in Express launches the MCP Server script as a child process and communicates directly over standard input/output streams. | Local CLI tools, desktop apps (like Claude Desktop & Cursor), zero port collisions. |
| [`demo-sse/`](./demo-sse/) | **HTTP + Server-Sent Events (SSE)** | The MCP Server runs as an independent HTTP server on port 3001 (`/sse` & `/messages`), and the Express app connects over the network. | Distributed systems, microservices, Docker/Kubernetes containers, remote agents. |

---

## High-Level Architecture & Lifecycle

```
[ User Request ]
       │
       │  POST /api/chat { "message": "Add a high priority task to review PR #42 by 3pm" }
       ▼
[ Express API Server ] (Port 3000)
       │
       │ 1. Discover available tools from MCP Server
       ▼
[ MCP Client ] ────────── ListToolsRequest ──────────► [ MCP Server ]
       │                                                      │
       │◄──────── Tools metadata (JSON Schema) ───────────────┘
       ▼
[ LLM Agent (OpenAI SDK) ]
       │
       │ 2. Converts MCP tools to OpenAI function calling schema
       │ 3. Sends prompt + tools to custom OpenAI endpoint (e.g. OpenAI, Ollama, OpenRouter)
       ▼
[ LLM (Custom Endpoint) ]
       │
       │ 4. Decides to call tool: "add_todo" with arguments
       │    { title: "Review PR #42", priority: "high", dueDate: "3pm" }
       ▼
[ MCP Client ] ────────── CallToolRequest ───────────► [ MCP Server ]
       │                                                      │
       │                                                      │ 5. Executes todoStore.add(...)
       │                                                      │    Returns { success: true, todo: {...} }
       │◄──────── Tool execution result ──────────────────────┘
       ▼
[ LLM Agent ]
       │
       │ 6. Appends tool result to conversation history
       │ 7. Calls LLM again to synthesize a friendly human response
       ▼
[ LLM (Custom Endpoint) ]
       │
       │ 8. Returns: "I have added 'Review PR #42' with high priority due at 3:00 PM."
       ▼
[ Express Server ]
       │
       │ 9. Returns final JSON payload (human message + executed tool calls + state)
       ▼
[ User ]
```

---

## MCP Todo Tools Implemented

Each MCP server implements 5 tools conforming to the MCP standard specification:
1. `add_todo`: Create tasks with `title`, optional `description`, `priority` (`"low" | "medium" | "high"`), and `dueDate`.
2. `list_todos`: Retrieve tasks filtered by `status` (`"all" | "pending" | "completed"`) and `priority`.
3. `complete_todo`: Mark a task as completed by `id`.
4. `delete_todo`: Remove a task by `id`.
5. `get_todo_summary`: Get statistics (`total`, `completed`, `pending`, `highPriority`).

---

## Quickstart

### 1. Stdio Transport Demo (`demo-stdio`)
The simplest way to start — single command launches both client and server:
```bash
# Install dependencies
cd demo-stdio/mcp-server && npm install
cd ../application && npm install

# Run automated offline simulation
npm run demo:mock

# Or start the Express server
npm start
```

### 2. SSE Transport Demo (`demo-sse`)
Demonstrates running client and server across separate HTTP endpoints:
```bash
# Install dependencies
cd demo-sse/mcp-server && npm install
cd ../application && npm install

# Run automated simulation (auto-boots local SSE server if not running)
npm run demo:mock

# Or run separately:
# Terminal 1 (MCP Server on port 3001):
cd demo-sse/mcp-server && npm start

# Terminal 2 (Express App on port 3000):
cd demo-sse/application && npm start
```

---

## Custom OpenAI Endpoint Configuration

Both applications support any OpenAI-compatible provider via `.env`:

```env
PORT=3000
OPENAI_API_KEY=your-api-key-here
OPENAI_BASE_URL=https://api.openai.com/v1     # Works with Ollama, OpenRouter, Groq, LM Studio, vLLM
OPENAI_MODEL=gpt-4o-mini
```

### Testing with `curl`
```bash
# Send natural language prompt to Express API
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Add a task to submit lecture 14 notes tonight"}'

# View current todos
curl http://localhost:3000/api/todos

# Inspect discovered MCP tools
curl http://localhost:3000/api/tools
```

---

## Automated Verification Tests

To run the complete test suite across all modules:
```bash
# Stdio MCP Server
npm test --prefix demo-stdio/mcp-server

# Stdio Application Layer
npm test --prefix demo-stdio/application

# SSE MCP Server
npm test --prefix demo-sse/mcp-server

# SSE Application Layer
npm test --prefix demo-sse/application
```
