# Design Specification: Express LLM Structured Output Service

## 1. Overview
This project ports the meeting extraction structured output demo from `../javascript-demo` into an Express.js HTTP service located in `lec-13/code`. It allows extracting structured meeting metadata (`title`, `attendee`, `date`, `time`, `durationMinutes`) from natural language input via a custom OpenAI-compatible endpoint and model, implemented using standard JavaScript functions (no classes).

## 2. Requirements & Constraints
- **Module System**: ES Modules (`"type": "module"` in `package.json`).
- **Endpoint Compatibility**: OpenAI Chat Completions structured output (`client.beta.chat.completions.parse` with `zodResponseFormat`) to support OpenAI, Ollama, Groq, vLLM, and other OpenAI-compatible endpoints.
- **Custom Configuration**: Configurable via `.env` with fallback defaults:
  - `PORT`: default `3000`
  - `OPENAI_API_KEY`: API key or default `"dummy-key"`
  - `OPENAI_BASE_URL`: Optional custom base URL (e.g. `http://localhost:11434/v1`)
  - `OPENAI_MODEL`: Optional custom model name (default `"gpt-4o-mini"`)
- **Coding Style**: Functional paradigm with plain functions only (no ES6 `class` or constructor syntax).
- **Architecture**: Single-file Express application in `index.js`.
- **API Specification**:
  - `POST /api/schedule`
  - Request Body: `{ "message": "Schedule a project review with Aditya tomorrow at 3 PM for 45 minutes." }`
  - Success Response: `200 OK`
    ```json
    {
      "success": true,
      "data": {
        "title": "Project Review",
        "attendee": "Aditya",
        "date": "2026-10-07",
        "time": "15:00",
        "durationMinutes": 45
      }
    }
    ```
  - Error Response: `400 Bad Request` if message is invalid; `500 Internal Server Error` if processing fails.

## 3. Data Schema
Using Zod:
```javascript
const MeetingDetailsSchema = z.object({
  title: z.string().describe("Brief title for the meeting"),
  attendee: z.string().describe("Person to meet with"),
  date: z.string().describe("Date in yyyy-MM-dd format"),
  time: z.string().describe("Time in 24-hour HH:mm format"),
  durationMinutes: z.number().int().describe("Meeting duration in minutes"),
});
```

## 4. System Prompt and Extraction Logic
- System prompt injects today's date in `yyyy-MM-dd` format.
- Instructs the model on relative date parsing, 24h time formatting, default 30 minute duration, and avoiding invented information.
- Functional pipeline:
  - `createOpenAIClient()`: Returns an instantiated `OpenAI` client instance using environment variables.
  - `buildSystemPrompt()`: Generates the system prompt containing today's date.
  - `scheduleMeeting(message, client, model)`: Calls `client.beta.chat.completions.parse` and returns `completion.choices[0].message.parsed`.

## 5. Express Application
- Middleware: `express.json()`.
- Routes:
  - `POST /api/schedule`: Validates `req.body.message`, invokes `scheduleMeeting(message)`, and returns structured response.
- Server startup: Listens on configured `PORT`.

## 6. Testing & Verification
- Automated tests using `node:test` and `node:assert`:
  - Input validation (missing or non-string message returns 400).
  - Mocked OpenAI client test ensuring `scheduleMeeting` executes and parses response format properly without requiring external network calls.
- Manual verification via `curl` against running server.
