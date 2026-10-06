# Express LLM Structured Output Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement an Express.js API service in `code/` that extracts structured meeting information from user input using custom OpenAI-compatible endpoints and models via standard functions (no classes).

**Architecture:** Single-file Express application (`index.js`) using ES Modules, Zod schemas, and OpenAI's `chat.completions.parse` with `zodResponseFormat`. Configurable via `.env` for custom `OPENAI_BASE_URL` and `OPENAI_MODEL`.

**Tech Stack:** Node.js (v26+), Express 5, OpenAI Node SDK, Zod, dotenv, Node test runner (`node:test`, `node:assert`).

**Spec:** `docs/superpowers/specs/2026-10-06-express-llm-structured-output-design.md`

## Global Constraints

- Module system: ES Modules (`"type": "module"` in `package.json`).
- Coding style: Functional paradigm only; no ES6 `class` or constructor syntax.
- Endpoint compatibility: Uses OpenAI Chat Completions structured outputs (`beta.chat.completions.parse` with `zodResponseFormat`) to support OpenAI, Ollama, Groq, vLLM, etc.
- Configurable environment variables: `PORT` (default `3000`), `OPENAI_API_KEY` (default `"dummy-key"`), `OPENAI_BASE_URL` (optional), `OPENAI_MODEL` (default `"gpt-4o-mini"`).
- API endpoint: `POST /api/schedule` accepting `{ "message": string }` and returning `{ "success": true, "data": { ... } }`.

---

### Task 1: Project Configuration and Environment Scaffolding

**Files:**
- Modify: `package.json`
- Create: `.env.example`
- Create: `.env`

**Interfaces:**
- Produces: ES Module support, npm scripts (`start`, `test`), and `.env` template.

- [x] **Step 1: Update package.json to ES Modules and add test scripts**

Update `package.json`:
```json
{
  "name": "code",
  "version": "1.0.0",
  "description": "Express LLM Structured Output Service",
  "main": "index.js",
  "type": "module",
  "scripts": {
    "start": "node index.js",
    "test": "node --test test/*.test.js"
  },
  "devDependencies": {
    "@types/express": "^5.0.6",
    "@types/node": "^26.6.4",
    "dotenv": "^18.0.5"
  },
  "dependencies": {
    "express": "^5.2.1",
    "openai": "^7.28.0",
    "zod": "^4.6.5"
  }
}
```

- [x] **Step 2: Create .env.example and .env template**

Create `.env.example`:
```env
PORT=3000
OPENAI_API_KEY=your-api-key-here
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4o-mini
```

Create `.env`:
```env
PORT=3000
OPENAI_API_KEY=dummy-key
OPENAI_BASE_URL=
OPENAI_MODEL=gpt-4o-mini
```

- [x] **Step 3: Verify package.json syntax with node**

Run: `node -e "import('./package.json', { with: { type: 'json' } }).then(pkg => console.log('Type:', pkg.default.type))"`
Expected: Output `Type: module`

- [x] **Step 4: Commit**

```bash
git add package.json .env.example
git commit -m "chore: configure ES modules and environment template"
```

---

### Task 2: Core Schema and Functional Extraction (`scheduleMeeting`)

**Files:**
- Create: `index.js` (schema, prompt builder, OpenAI factory, `scheduleMeeting`)
- Test: `test/scheduleMeeting.test.js`

**Interfaces:**
- Produces:
  - `MeetingDetailsSchema`: Zod schema for title, attendee, date, time, durationMinutes.
  - `buildSystemPrompt()`: Returns formatted system prompt with today's date.
  - `createOpenAIClient(config)`: Returns an instantiated OpenAI client.
  - `scheduleMeeting(message, client, model)`: Extracts and returns parsed meeting details.

- [x] **Step 1: Write failing unit test for `scheduleMeeting`**

Create `test/scheduleMeeting.test.js`:
```javascript
import test from "node:test";
import assert from "node:assert/strict";
import { MeetingDetailsSchema, buildSystemPrompt, scheduleMeeting } from "../index.js";

test("buildSystemPrompt contains today's date in yyyy-MM-dd format", () => {
  const prompt = buildSystemPrompt();
  const today = new Date().toLocaleDateString("en-CA");
  assert.match(prompt, new RegExp(today));
  assert.match(prompt, /Convert relative dates/);
});

test("MeetingDetailsSchema validates expected structured meeting object", () => {
  const validData = {
    title: "Project Sync",
    attendee: "Alice",
    date: "2026-10-07",
    time: "14:00",
    durationMinutes: 30,
  };
  const parsed = MeetingDetailsSchema.parse(validData);
  assert.deepEqual(parsed, validData);
});

test("scheduleMeeting extracts data using provided mock client", async () => {
  const expectedDetails = {
    title: "Project Review",
    attendee: "Aditya",
    date: "2026-10-07",
    time: "15:00",
    durationMinutes: 45,
  };

  const mockClient = {
    beta: {
      chat: {
        completions: {
          parse: async (params) => {
            assert.equal(params.model, "test-model");
            assert.equal(params.messages[1].content, "Schedule meeting with Aditya tomorrow at 3 PM");
            return {
              choices: [
                {
                  message: {
                    parsed: expectedDetails,
                  },
                },
              ],
            };
          },
        },
      },
    },
  };

  const result = await scheduleMeeting(
    "Schedule meeting with Aditya tomorrow at 3 PM",
    mockClient,
    "test-model"
  );
  assert.deepEqual(result, expectedDetails);
});

test("scheduleMeeting throws when model refuses", async () => {
  const mockClient = {
    beta: {
      chat: {
        completions: {
          parse: async () => ({
            choices: [
              {
                message: {
                  parsed: null,
                  refusal: "I cannot fulfill this request.",
                },
              },
            ],
          }),
        },
      },
    },
  };

  await assert.rejects(
    () => scheduleMeeting("Bad request", mockClient, "test-model"),
    /I cannot fulfill this request/
  );
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `node --test test/scheduleMeeting.test.js`
Expected: FAIL (Cannot find module `../index.js`)

- [x] **Step 3: Write minimal implementation in `index.js`**

Create `index.js`:
```javascript
import "dotenv/config";
import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";

export const MeetingDetailsSchema = z.object({
  title: z.string().describe("Brief title for the meeting"),
  attendee: z.string().describe("Person to meet with"),
  date: z.string().describe("Date in yyyy-MM-dd format"),
  time: z.string().describe("Time in 24-hour HH:mm format"),
  durationMinutes: z.number().int().describe("Meeting duration in minutes"),
});

export function buildSystemPrompt() {
  const today = new Date().toLocaleDateString("en-CA");
  return `
You extract meeting information from the user's request.

Today's date is ${today}.

Rules:
- Convert relative dates like today and tomorrow into yyyy-MM-dd format.
- Convert time into 24-hour HH:mm format.
- If title is missing, create a simple title.
- If duration is missing, use 30 minutes.
- Do not invent attendee, date or time.
- If information is missing, keep it blank.
  `.trim();
}

export function createOpenAIClient(config = {}) {
  const apiKey = config.apiKey || process.env.OPENAI_API_KEY || "dummy-key";
  const baseURL = config.baseURL || process.env.OPENAI_BASE_URL || undefined;

  return new OpenAI({
    apiKey,
    baseURL: baseURL || undefined,
  });
}

export const defaultOpenAIClient = createOpenAIClient();
export const DEFAULT_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

export async function scheduleMeeting(message, client = defaultOpenAIClient, model = DEFAULT_MODEL) {
  const completion = await client.beta.chat.completions.parse({
    model,
    messages: [
      { role: "system", content: buildSystemPrompt() },
      { role: "user", content: message },
    ],
    response_format: zodResponseFormat(MeetingDetailsSchema, "meeting_details"),
  });

  const parsed = completion.choices?.[0]?.message?.parsed;
  if (!parsed) {
    const refusal = completion.choices?.[0]?.message?.refusal;
    throw new Error(refusal || "Failed to parse structured output from model");
  }

  return parsed;
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `node --test test/scheduleMeeting.test.js`
Expected: PASS (4 tests passed)

- [x] **Step 5: Commit**

```bash
git add index.js test/scheduleMeeting.test.js
git commit -m "feat: implement MeetingDetailsSchema and scheduleMeeting function"
```

---

### Task 3: Express HTTP Server & API Route

**Files:**
- Modify: `index.js` (add Express app, route `/api/schedule`, and server startup helper)
- Create: `test/server.test.js`

**Interfaces:**
- Produces:
  - `createApp(options)`: Function returning configured Express application.
  - `POST /api/schedule`: Accepts `{ message: string }`, returns `{ success: true, data: { ... } }` or `{ success: false, error: string }`.

- [x] **Step 1: Write integration tests for Express API**

Create `test/server.test.js`:
```javascript
import test from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../index.js";

const mockMeetingDetails = {
  title: "Sprint Review",
  attendee: "Bob",
  date: "2026-10-08",
  time: "10:00",
  durationMinutes: 45,
};

const mockClient = {
  beta: {
    chat: {
      completions: {
        parse: async () => ({
          choices: [{ message: { parsed: mockMeetingDetails } }],
        }),
      },
    },
  },
};

test("POST /api/schedule returns 400 when message is missing or invalid", async () => {
  const app = createApp({ client: mockClient });
  const server = app.listen(0);
  const port = server.address().port;

  try {
    const res = await fetch(`http://localhost:${port}/api/schedule`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.match(body.error, /message.*required/i);
  } finally {
    server.close();
  }
});

test("POST /api/schedule returns 200 with structured data on success", async () => {
  const app = createApp({ client: mockClient, model: "test-model" });
  const server = app.listen(0);
  const port = server.address().port;

  try {
    const res = await fetch(`http://localhost:${port}/api/schedule`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "Schedule sprint review with Bob tomorrow at 10 AM for 45 minutes" }),
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.deepEqual(body.data, mockMeetingDetails);
  } finally {
    server.close();
  }
});

test("POST /api/schedule returns 500 when extraction fails", async () => {
  const failingClient = {
    beta: {
      chat: {
        completions: {
          parse: async () => {
            throw new Error("Upstream LLM error");
          },
        },
      },
    },
  };

  const app = createApp({ client: failingClient });
  const server = app.listen(0);
  const port = server.address().port;

  try {
    const res = await fetch(`http://localhost:${port}/api/schedule`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "Schedule meeting" }),
    });

    assert.equal(res.status, 500);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.match(body.error, /Upstream LLM error/);
  } finally {
    server.close();
  }
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `node --test test/server.test.js`
Expected: FAIL (`createApp` is not a function)

- [x] **Step 3: Update `index.js` to implement Express app and server startup**

Update `index.js` to export `createApp` and start server when run directly:
```javascript
import "dotenv/config";
import express from "express";
import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { fileURLToPath } from "node:url";
import { z } from "zod";

export const MeetingDetailsSchema = z.object({
  title: z.string().describe("Brief title for the meeting"),
  attendee: z.string().describe("Person to meet with"),
  date: z.string().describe("Date in yyyy-MM-dd format"),
  time: z.string().describe("Time in 24-hour HH:mm format"),
  durationMinutes: z.number().int().describe("Meeting duration in minutes"),
});

export function buildSystemPrompt() {
  const today = new Date().toLocaleDateString("en-CA");
  return `
You extract meeting information from the user's request.

Today's date is ${today}.

Rules:
- Convert relative dates like today and tomorrow into yyyy-MM-dd format.
- Convert time into 24-hour HH:mm format.
- If title is missing, create a simple title.
- If duration is missing, use 30 minutes.
- Do not invent attendee, date or time.
- If information is missing, keep it blank.
  `.trim();
}

export function createOpenAIClient(config = {}) {
  const apiKey = config.apiKey || process.env.OPENAI_API_KEY || "dummy-key";
  const baseURL = config.baseURL || process.env.OPENAI_BASE_URL || undefined;

  return new OpenAI({
    apiKey,
    baseURL: baseURL || undefined,
  });
}

export const defaultOpenAIClient = createOpenAIClient();
export const DEFAULT_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

export async function scheduleMeeting(message, client = defaultOpenAIClient, model = DEFAULT_MODEL) {
  const completion = await client.beta.chat.completions.parse({
    model,
    messages: [
      { role: "system", content: buildSystemPrompt() },
      { role: "user", content: message },
    ],
    response_format: zodResponseFormat(MeetingDetailsSchema, "meeting_details"),
  });

  const parsed = completion.choices?.[0]?.message?.parsed;
  if (!parsed) {
    const refusal = completion.choices?.[0]?.message?.refusal;
    throw new Error(refusal || "Failed to parse structured output from model");
  }

  return parsed;
}

export function createApp(options = {}) {
  const app = express();
  const client = options.client || defaultOpenAIClient;
  const model = options.model || DEFAULT_MODEL;

  app.use(express.json());

  app.post("/api/schedule", async (req, res) => {
    try {
      const { message } = req.body || {};
      if (!message || typeof message !== "string" || !message.trim()) {
        return res.status(400).json({
          success: false,
          error: "Field 'message' is required and must be a non-empty string.",
        });
      }

      const meetingDetails = await scheduleMeeting(message, client, model);

      return res.status(200).json({
        success: true,
        data: meetingDetails,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: error.message || "Failed to process meeting request",
      });
    }
  });

  return app;
}

// Start server when run directly
const isDirectExecution = process.argv[1] === fileURLToPath(import.meta.url);
if (isDirectExecution) {
  const PORT = process.env.PORT || 3000;
  const app = createApp();
  app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
    console.log(`Model: ${DEFAULT_MODEL}`);
    console.log(`Base URL: ${process.env.OPENAI_BASE_URL || "Default OpenAI"}`);
  });
}
```

- [x] **Step 4: Run integration tests to verify they pass**

Run: `node --test test/server.test.js`
Expected: PASS (3 tests passed)

- [x] **Step 5: Run full test suite**

Run: `npm test`
Expected: PASS (All tests pass)

- [x] **Step 6: Commit**

```bash
git add index.js test/server.test.js
git commit -m "feat: implement Express app and /api/schedule endpoint"
```

---

### Task 4: Documentation & Manual Verification

**Files:**
- Create: `README.md`

**Interfaces:**
- Documents setup, environment variables, API usage, and curl examples.

- [x] **Step 1: Create README.md**

Create `README.md` documenting:
- How to install dependencies (`npm install`).
- How to configure `.env` with custom `OPENAI_BASE_URL` and `OPENAI_MODEL`.
- How to run the server (`npm start`).
- Example curl request:
  ```bash
  curl -X POST http://localhost:3000/api/schedule \
    -H "Content-Type: application/json" \
    -d '{"message": "Schedule a project review with Aditya tomorrow at 3 PM for 45 minutes."}'
  ```

- [x] **Step 2: Commit documentation**

```bash
git add README.md
git commit -m "docs: add README with configuration and usage instructions"
```
