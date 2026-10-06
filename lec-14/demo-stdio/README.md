# Demo 1: Model Context Protocol (MCP) over Stdio Transport

This demo illustrates the standard local Model Context Protocol (MCP) flow:
* **`mcp-server/`**: Standalone MCP server exposing 5 Todo tools over `StdioServerTransport`.
* **`application/`**: Express REST API + MCP Client connected via `StdioClientTransport`. When the Express application starts, it automatically spawns the MCP server as a child process and communicates over standard I/O (`stdin`/`stdout`).
* **LLM Layer**: Converts MCP tools into OpenAI function calling format, invokes an OpenAI-compatible custom endpoint, executes tool calls via the MCP Client, and responds to the user with a natural language summary.

---

## Architecture Flow

```
[ User Prompt (curl/HTTP) ]
       │  POST /api/chat
       ▼
[ Express API Server ]
       │
       │  1. client.listTools()
       ▼
[ MCP Client ] ───(JSON-RPC via stdin/stdout)───► [ MCP Server Process ]
       │                                                   │
       │◄─── Tool definitions (add_todo, list_todos...) ───┘
       ▼
[ OpenAI / Custom LLM Endpoint ]
       │  2. Calls LLM with prompt + tool definitions
       │  3. LLM returns tool_call: "add_todo", args: {...}
       ▼
[ MCP Client ] ───(JSON-RPC CallTool)───────────► [ MCP Server Process ]
       │                                                   │
       │◄─── Result: { success: true, todo: {...} } ───────┘
       ▼
[ OpenAI / Custom LLM Endpoint ]
       │  4. Feeds tool result into LLM conversation
       │  5. LLM generates natural human response
       ▼
[ Express API Server ]
       │  6. Sends final JSON back to user
       ▼
[ User ]
```

---

## Setup & Running

### 1. Install Dependencies
```bash
# In mcp-server:
cd demo-stdio/mcp-server
npm install

# In application:
cd ../application
npm install
```

### 2. Configure Environment (`.env`)
Copy `.env.example` to `.env` in `demo-stdio/application`:
```bash
cp .env.example .env
```
Edit `.env` if you have a custom OpenAI endpoint:
```env
PORT=3000
OPENAI_API_KEY=your-api-key-here
OPENAI_BASE_URL=https://api.openai.com/v1     # Or Ollama: http://localhost:11434/v1, OpenRouter, Groq, etc.
OPENAI_MODEL=gpt-4o-mini
```

---

## Running the Demonstrations

### Quick Offline Simulation (No API Key Required)
Run the automated CLI demo script:
```bash
cd demo-stdio/application
npm run demo:mock
```
This boots the MCP Server over Stdio, discovers all tools, performs task creations, task listings, completion, and statistics without needing an external API key.

### Live LLM Demo Script
Once `.env` is configured with your API key / custom endpoint:
```bash
npm run demo:live
```

---

## Starting the Express Server

```bash
cd demo-stdio/application
npm start
```
The server will start at `http://localhost:3000`.

### REST API Endpoints

#### 1. Check Health & MCP Status
```bash
curl http://localhost:3000/health
```

#### 2. Discover MCP Tools
```bash
curl http://localhost:3000/api/tools
```

#### 3. Send Natural Language Prompt to LLM + MCP Tools
```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Add a high priority task to prepare Lecture 14 slides due tomorrow at 5 PM"}'
```

#### 4. Offline Test via API (Mock Mode)
```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Submit weekly assignment", "mock": true}'
```

#### 5. List Current Todos
```bash
curl http://localhost:3000/api/todos
```

---

## Running Automated Tests
```bash
# Test MCP Server:
cd demo-stdio/mcp-server && npm test

# Test Application & Endpoints:
cd demo-stdio/application && npm test
```
