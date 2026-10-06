# Demo 2: Model Context Protocol (MCP) over SSE / HTTP Transport

This demo illustrates the remote network Model Context Protocol (MCP) flow using Server-Sent Events (SSE) and HTTP POST messages:
* **`mcp-server/`**: Standalone HTTP microservice listening on port 3001 using `@modelcontextprotocol/sdk/server/sse.js`. Exposes `GET /sse` for event streaming and `POST /messages` for JSON-RPC message dispatch.
* **`application/`**: Express REST API running on port 3000 with `SSEClientTransport` connected to `http://localhost:3001/sse`.
* **LLM Layer**: Converts MCP tools into OpenAI function calling format, invokes an OpenAI-compatible custom endpoint, executes tool calls via the MCP Client over the network, and responds to the user with a natural language summary.

---

## Architecture Flow

```
[ User Prompt (curl/HTTP) ]
       │  POST /api/chat
       ▼
[ Express API Server (Port 3000) ]
       │
       │  1. client.listTools()
       ▼
[ MCP Client (SSEClientTransport) ]
       │
       ├──── GET /sse (SSE Stream) ────────► [ MCP Server (Port 3001) ]
       ├──── POST /messages (JSON-RPC) ────► [ MCP Server (Port 3001) ]
       │                                            │
       │◄─── Tool definitions (add_todo...) ────────┘
       ▼
[ OpenAI / Custom LLM Endpoint ]
       │  2. Calls LLM with prompt + tool definitions
       │  3. LLM returns tool_call: "add_todo", args: {...}
       ▼
[ MCP Client ] ───(POST /messages)──────────► [ MCP Server (Port 3001) ]
       │                                            │
       │◄─── Tool result (via SSE stream) ──────────┘
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
cd demo-sse/mcp-server
npm install

# In application:
cd ../application
npm install
```

### 2. Configure Environment (`.env`)
Copy `.env.example` to `.env` in `demo-sse/application`:
```bash
cp .env.example .env
```
Edit `.env` if you have a custom OpenAI endpoint:
```env
PORT=3000
MCP_SERVER_PORT=3001
MCP_SERVER_URL=http://localhost:3001/sse

OPENAI_API_KEY=your-api-key-here
OPENAI_BASE_URL=https://api.openai.com/v1     # Or Ollama: http://localhost:11434/v1, OpenRouter, Groq, etc.
OPENAI_MODEL=gpt-4o-mini
```

---

## Running the Demonstrations

### Quick Offline Simulation (No API Key Required)
Run the automated CLI demo script:
```bash
cd demo-sse/application
npm run demo:mock
```
*(Note: If the MCP SSE Server is not already running, the script automatically boots an in-process SSE server on port 3001 to run the demo seamlessly).*

### Running Both Servers Separately

#### Terminal 1: Start MCP Server
```bash
cd demo-sse/mcp-server
npm start
# Server listens at http://localhost:3001
```

#### Terminal 2: Start Express Application
```bash
cd demo-sse/application
npm start
# App connects to http://localhost:3001/sse and listens at http://localhost:3000
```

### Live LLM Demo Script
Once `.env` is configured with your API key / custom endpoint:
```bash
cd demo-sse/application
npm run demo:live
```

---

## REST API Endpoints

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
  -d '{"message": "Add a medium priority task to prepare lecture slides"}'
```

#### 4. Offline Test via API (Mock Mode)
```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Submit report", "mock": true}'
```

#### 5. List Current Todos
```bash
curl http://localhost:3000/api/todos
```

---

## Running Automated Tests
```bash
# Test MCP SSE Server:
cd demo-sse/mcp-server && npm test

# Test Application & Endpoints:
cd demo-sse/application && npm test
```
