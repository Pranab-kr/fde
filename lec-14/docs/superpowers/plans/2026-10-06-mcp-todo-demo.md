# MCP Todo Demo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a complete, working demo application showcasing the Model Context Protocol (MCP) server, MCP client, Express REST API, and custom OpenAI-compatible LLM agent for a Todo domain, implemented in both Stdio and SSE transport variants.

**Architecture:** Create two independent demo projects (`demo-stdio` and `demo-sse`). Each contains an `mcp-server` that exposes 5 Todo management tools over MCP, and an `application` layer that connects to the MCP server via an MCP Client, converts tools for OpenAI function calling, calls an OpenAI-compatible custom endpoint, dispatches tool execution to the MCP server, and returns friendly human-readable messages to the user via Express.

**Tech Stack:** Node.js (ESM), `@modelcontextprotocol/sdk` (1.32.1), `express` (v5/v4), `openai` (v7), `dotenv`, Node.js native test runner (`node --test`).

**Spec:** `docs/superpowers/specs/2026-10-06-mcp-todo-demo-design.md`

## Global Constraints
- Target directory: `/home/pranab/play/fda/lec-14`
- Separate folders: `demo-stdio/` and `demo-sse/`
- Module type: ESM (`"type": "module"` in package.json)
- Custom OpenAI endpoint support via `OPENAI_BASE_URL`, `OPENAI_API_KEY`, `OPENAI_MODEL`
- Full suite of 5 tools: `add_todo`, `list_todos`, `complete_todo`, `delete_todo`, `get_todo_summary`
- Pure REST API and CLI scripts (no frontend)
- Node test runner: `node --test`

---

### Task 1: Implement `demo-stdio/mcp-server`

**Files:**
- Create: `demo-stdio/mcp-server/package.json`
- Create: `demo-stdio/mcp-server/src/todoStore.js`
- Create: `demo-stdio/mcp-server/src/server.js`
- Create: `demo-stdio/mcp-server/index.js`
- Test: `demo-stdio/mcp-server/test/todoStore.test.js`

**Interfaces:**
- Produces: `TodoStore` class with `add()`, `list()`, `complete()`, `delete()`, `summary()`.
- Produces: `createMcpServer(todoStore)` returning an MCP `Server` configured with `add_todo`, `list_todos`, `complete_todo`, `delete_todo`, `get_todo_summary`.
- Produces: `index.js` executable script listening on `StdioServerTransport`.

- [ ] **Step 1: Write test for `TodoStore`**
Write unit test covering `add()`, `list()`, `complete()`, `delete()`, and `summary()` methods.

- [ ] **Step 2: Run test to verify it fails**
Run: `node --test demo-stdio/mcp-server/test/todoStore.test.js`
Expected: FAIL (file or class not found).

- [ ] **Step 3: Implement `TodoStore`**
Create `demo-stdio/mcp-server/src/todoStore.js` managing an in-memory array of todo objects:
`{ id, title, description, priority, dueDate, completed, createdAt }`.

- [ ] **Step 4: Implement `createMcpServer` and Stdio entry point**
Create `demo-stdio/mcp-server/src/server.js` using `@modelcontextprotocol/sdk/server/index.js` with `ListToolsRequestSchema` and `CallToolRequestSchema`.
Create `demo-stdio/mcp-server/index.js` which connects the server to `StdioServerTransport`.

- [ ] **Step 5: Run tests to verify they pass**
Run: `npm test` inside `demo-stdio/mcp-server/`.
Expected: PASS.

- [ ] **Step 6: Commit**
`git add demo-stdio/mcp-server && git commit -m "feat(stdio): implement MCP Todo server with stdio transport"`

---

### Task 2: Implement `demo-stdio/application`

**Files:**
- Create: `demo-stdio/application/package.json`
- Create: `demo-stdio/application/.env.example`
- Create: `demo-stdio/application/src/mcpClient.js`
- Create: `demo-stdio/application/src/llmAgent.js`
- Create: `demo-stdio/application/src/server.js`
- Create: `demo-stdio/application/scripts/run-demo.js`
- Test: `demo-stdio/application/test/demo.test.js`
- Create: `demo-stdio/README.md`

**Interfaces:**
- Consumes: `demo-stdio/mcp-server/index.js` via `StdioClientTransport`.
- Produces: `getMcpClient()` initializing MCP client connected to stdio server.
- Produces: `processUserPrompt(prompt, { mcpClient, openaiClient })` converting tools, handling OpenAI tool calls, and generating friendly text.
- Produces: Express API at `PORT=3000` exposing `POST /api/chat`, `GET /api/todos`, `GET /api/tools`, `GET /health`.

- [ ] **Step 1: Write integration test for `demo-stdio/application`**
Write `demo-stdio/application/test/demo.test.js` to test:
1. `mcpClient` connects to `mcp-server` over stdio and lists 5 tools.
2. `mcpClient.callTool` adds a task and lists tasks.
3. Express REST API `POST /api/chat` handles simulated and live agent requests.

- [ ] **Step 2: Run test to verify it fails**
Run: `node --test demo-stdio/application/test/demo.test.js`
Expected: FAIL.

- [ ] **Step 3: Implement `mcpClient.js` and `llmAgent.js`**
Create `mcpClient.js` using `Client` and `StdioClientTransport` pointing to `demo-stdio/mcp-server/index.js`.
Create `llmAgent.js` using `openai` SDK with `baseURL: process.env.OPENAI_BASE_URL`. Convert MCP `inputSchema` to OpenAI tool schema format, handle tool calls with `client.callTool`, loop back tool results to LLM, and return human text.

- [ ] **Step 4: Implement Express `server.js` and CLI runner**
Implement Express endpoints in `src/server.js`.
Create `scripts/run-demo.js` to demonstrate command-line chat interactions (both mock/offline and live LLM mode).
Create `.env.example` and `README.md` with curl examples.

- [ ] **Step 5: Run tests and verify end-to-end execution**
Run: `npm test` inside `demo-stdio/application/`.
Run: `node scripts/run-demo.js --mock` to verify the complete mock cycle.
Expected: All tests pass and demo script outputs human-friendly messages and tool trace.

- [ ] **Step 6: Commit**
`git add demo-stdio && git commit -m "feat(stdio): implement application layer, express API, and demo script"`

---

### Task 3: Implement `demo-sse/mcp-server`

**Files:**
- Create: `demo-sse/mcp-server/package.json`
- Create: `demo-sse/mcp-server/src/todoStore.js`
- Create: `demo-sse/mcp-server/src/server.js`
- Create: `demo-sse/mcp-server/index.js`
- Test: `demo-sse/mcp-server/test/sseServer.test.js`

**Interfaces:**
- Produces: MCP Server over `SSEServerTransport` hosted on Express at `MCP_SERVER_PORT=3001`.
- Exposes: `GET /sse` (SSE connection) and `POST /messages` (JSON-RPC requests).

- [ ] **Step 1: Write integration test for SSE MCP server**
Write `demo-sse/mcp-server/test/sseServer.test.js` to verify server boots on HTTP port and establishes SSE transport.

- [ ] **Step 2: Run test to verify it fails**
Run: `node --test demo-sse/mcp-server/test/sseServer.test.js`
Expected: FAIL.

- [ ] **Step 3: Implement SSE MCP server and endpoints**
Implement `todoStore.js` and `server.js` using `SSEServerTransport` on Express.
Configure `/sse` route to attach `SSEServerTransport` to the MCP `Server`.
Configure `/messages` route to handle inbound messages via `transport.handlePostMessage`.

- [ ] **Step 4: Run tests to verify they pass**
Run: `npm test` inside `demo-sse/mcp-server/`.
Expected: PASS.

- [ ] **Step 5: Commit**
`git add demo-sse/mcp-server && git commit -m "feat(sse): implement MCP Todo server with SSE transport"`

---

### Task 4: Implement `demo-sse/application`

**Files:**
- Create: `demo-sse/application/package.json`
- Create: `demo-sse/application/.env.example`
- Create: `demo-sse/application/src/mcpClient.js`
- Create: `demo-sse/application/src/llmAgent.js`
- Create: `demo-sse/application/src/server.js`
- Create: `demo-sse/application/scripts/run-demo.js`
- Test: `demo-sse/application/test/demo.test.js`
- Create: `demo-sse/README.md`

**Interfaces:**
- Consumes: `http://localhost:3001/sse` via `SSEClientTransport`.
- Produces: `getMcpClient()` connecting over SSE.
- Produces: Express REST API at `PORT=3000` exposing `POST /api/chat`, `GET /api/todos`, `GET /api/tools`.

- [ ] **Step 1: Write integration test for `demo-sse/application`**
Write test in `demo-sse/application/test/demo.test.js` testing SSE client connection, tool discovery, and tool execution against the SSE server.

- [ ] **Step 2: Run test to verify it fails**
Run: `node --test demo-sse/application/test/demo.test.js`
Expected: FAIL.

- [ ] **Step 3: Implement `mcpClient.js` and Express application**
Implement `mcpClient.js` with `SSEClientTransport(new URL(process.env.MCP_SERVER_URL || "http://localhost:3001/sse"))`.
Implement `llmAgent.js`, Express `server.js`, `scripts/run-demo.js`, `.env.example`, and `README.md`.

- [ ] **Step 4: Run tests and verify end-to-end execution**
Run: `npm test` inside `demo-sse/application/`.
Run: `node scripts/run-demo.js --mock` verifying SSE tool execution.
Expected: PASS.

- [ ] **Step 5: Commit**
`git add demo-sse && git commit -m "feat(sse): implement application layer, express API, and demo script"`

---

### Task 5: Root Documentation & Verification

**Files:**
- Create: `README.md` (top-level guide explaining MCP, architecture differences between Stdio and SSE, setup, curl examples)
- Clean up any temporary directories (empty `application/` and `mcp-server/` in root)

- [ ] **Step 1: Create top-level `README.md`**
Provide a comprehensive overview of Model Context Protocol, comparing Stdio vs SSE, explaining the LLM tool calling flow, instructions to run both demos with curl commands and custom OpenAI endpoints.

- [ ] **Step 2: Remove redundant empty placeholder folders**
Remove empty root `lec-14/application` and `lec-14/mcp-server` so that only `demo-stdio/` and `demo-sse/` remain clean and organized.

- [ ] **Step 3: Run full verification suite across both demos**
Verify `npm test` passes in `demo-stdio/mcp-server`, `demo-stdio/application`, `demo-sse/mcp-server`, and `demo-sse/application`.

- [ ] **Step 4: Commit**
`git add -A && git commit -m "docs: add root guide and complete MCP demo project"`
