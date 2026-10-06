# Design Specification: MCP Todo Demo Application (Stdio & SSE)

## 1. Overview
This project provides a demonstration of the Model Context Protocol (MCP) using a Todo management domain. It illustrates how an MCP Server exposes tools, an MCP Client discovers and invokes them, and an Application Layer (Express + OpenAI LLM) orchestrates natural language prompts from users into tool executions and human-readable responses.

The project is structured into two completely independent, self-contained sub-projects to demonstrate both primary transport protocols:
1. `demo-stdio/`: Demonstrates local child-process standard input/output transport (`StdioServerTransport` / `StdioClientTransport`).
2. `demo-sse/`: Demonstrates network HTTP transport with Server-Sent Events (`SSEServerTransport` / `SSEClientTransport`).

---

## 2. Directory Structure

```text
lec-14/
├── docs/
│   └── superpowers/
│       └── specs/
│           └── 2026-10-06-mcp-todo-demo-design.md
├── demo-stdio/
│   ├── README.md
│   ├── mcp-server/
│   │   ├── package.json
│   │   ├── src/
│   │   │   ├── todoStore.js
│   │   │   └── server.js
│   │   └── index.js
│   └── application/
│       ├── package.json
│       ├── .env.example
│       ├── src/
│       │   ├── mcpClient.js
│       │   ├── llmAgent.js
│       │   └── server.js
│       ├── test/
│       │   └── demo.test.js
│       └── scripts/
│           └── run-demo.js
└── demo-sse/
    ├── README.md
    ├── mcp-server/
    │   ├── package.json
    │   ├── src/
    │   │   ├── todoStore.js
    │   │   └── server.js
    │   └── index.js
    └── application/
        ├── package.json
        ├── .env.example
        ├── src/
        │   ├── mcpClient.js
        │   ├── llmAgent.js
        │   └── server.js
        ├── test/
        │   └── demo.test.js
        └── scripts/
            └── run-demo.js
```

---

## 3. MCP Todo Tools Specification

Both MCP servers expose the following 5 tools using `@modelcontextprotocol/sdk`:

### 3.1. `add_todo`
* **Description**: Create a new todo task.
* **Input Schema**:
  * `title` (string, required): The task description/title.
  * `description` (string, optional): Detailed notes for the task.
  * `priority` (string, optional, enum: `["low", "medium", "high"]`, default: `"medium"`).
  * `dueDate` (string, optional): Optional due date or time string.
* **Return Value**: JSON object containing the created task (`id`, `title`, `description`, `priority`, `dueDate`, `completed: false`, `createdAt`).

### 3.2. `list_todos`
* **Description**: Retrieve list of current todo tasks.
* **Input Schema**:
  * `status` (string, optional, enum: `["all", "pending", "completed"]`, default: `"all"`).
  * `priority` (string, optional, enum: `["low", "medium", "high"]`).
* **Return Value**: JSON array of matching tasks.

### 3.3. `complete_todo`
* **Description**: Mark a todo item as completed by ID.
* **Input Schema**:
  * `id` (string, required): The unique task ID.
* **Return Value**: JSON object of updated task, or error if not found.

### 3.4. `delete_todo`
* **Description**: Delete a todo item by ID.
* **Input Schema**:
  * `id` (string, required): The unique task ID.
* **Return Value**: JSON confirmation with deleted ID, or error if not found.

### 3.5. `get_todo_summary`
* **Description**: Retrieve aggregate summary statistics of todos.
* **Input Schema**: `{}` (none).
* **Return Value**: Summary object: `{ total, completed, pending, highPriority }`.

---

## 4. Components & Transports

### 4.1. Stdio Implementation (`demo-stdio`)
* **MCP Server**:
  * Uses `Server` from `@modelcontextprotocol/sdk/server/index.js`.
  * Connects via `StdioServerTransport` from `@modelcontextprotocol/sdk/server/stdio.js`.
  * Logs internal debug messages to `stderr` (preserving `stdout` exclusively for JSON-RPC framing).
* **MCP Client**:
  * Uses `Client` from `@modelcontextprotocol/sdk/client/index.js`.
  * Connects via `StdioClientTransport({ command: "node", args: ["<path-to-mcp-server>/index.js"] })`.
  * Automatically spawns and terminates the MCP server child process.

### 4.2. SSE Implementation (`demo-sse`)
* **MCP Server**:
  * Express server listening on `MCP_SERVER_PORT` (default: `3001`).
  * Uses `SSEServerTransport` from `@modelcontextprotocol/sdk/server/sse.js`.
  * Endpoints:
    * `GET /sse`: Establishes SSE stream connection with the client.
    * `POST /messages`: Handles inbound JSON-RPC client messages.
* **MCP Client**:
  * Uses `Client` from `@modelcontextprotocol/sdk/client/index.js`.
  * Connects via `SSEClientTransport(new URL("http://localhost:3001/sse"))`.

---

## 5. Application Layer (Express & LLM Agent)

### 5.1. Express Server Endpoints
* `POST /api/chat`:
  * Body: `{ "message": "Create a high priority task to review PR #12 tomorrow" }`
  * Process:
    1. Fetches tools from MCP client via `client.listTools()`.
    2. Converts tools into OpenAI function calling format.
    3. Invokes OpenAI Chat Completions API.
    4. If LLM requests `tool_calls`, dispatches them sequentially through `client.callTool({ name, arguments })`.
    5. Feeds tool responses back into messages array as role `"tool"`.
    6. Calls LLM again to synthesize a clear, friendly human response.
    7. Responds with JSON:
       ```json
       {
         "message": "I have created the task 'Review PR #12'...",
         "toolCallsExecuted": [
           {
             "name": "add_todo",
             "args": { "title": "Review PR #12", "priority": "high" },
             "result": { "id": "task-1", ... }
           }
         ],
         "todos": [ ... ]
       }
       ```
* `GET /api/todos`: Returns the current todo list directly from MCP `list_todos`.
* `GET /api/tools`: Returns the raw tools registered on the MCP server.
* `GET /health`: Health check endpoint.

### 5.2. OpenAI Custom Endpoint Support
* Uses the official `openai` Node.js SDK:
  ```js
  import OpenAI from 'openai';
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || 'dummy-key',
    baseURL: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1'
  });
  ```
* Supports standard OpenAI, OpenRouter, Groq, local Ollama, LM Studio, etc.

---

## 6. Error Handling Strategy
* **Tool Execution Errors**: Return `{ isError: true, content: [{ type: "text", text: "..." }] }` in MCP response so LLM can explain the failure politely.
* **Network & Connection Failures**: Express API catches MCP connection or timeout errors and replies with HTTP 503 and actionable remedy messages.
* **LLM API Failures**: Catch API errors (e.g., invalid endpoint, unauthorized) and return structured HTTP 500 error objects.

---

## 7. Verification & Automated Testing
1. **Automated Unit & Integration Tests**:
   * Uses Node.js native test runner `node --test`.
   * Directly tests MCP tools: `add_todo`, `list_todos`, `complete_todo`, `delete_todo`, `get_todo_summary`.
   * Tests MCP client-server communication across both transports.
2. **Offline Simulation Script (`npm run demo:mock`)**:
   * Runs the full Express API and MCP tool call loop using a deterministic mock LLM step to verify the end-to-end pipeline without needing an active API key or consuming credits.
3. **Live Script (`npm run demo:live`)**:
   * Runs a complete live demonstration using the user's configured OpenAI custom endpoint.
