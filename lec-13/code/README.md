# Express LLM Structured Output Service

This project implements an Express.js API service that extracts structured meeting information from natural language user input using OpenAI's structured outputs (`zodResponseFormat`).

It is based on the logic from `../javascript-demo`, but with the following key enhancements:
- **Express API**: Exposes a `POST /api/schedule` REST endpoint.
- **Custom Endpoint & Model Support**: Configurable via `.env` with `OPENAI_BASE_URL`, `OPENAI_API_KEY`, and `OPENAI_MODEL` to support OpenAI, Ollama, Groq, vLLM, and any OpenAI-compatible provider.
- **Pure Functional Style**: Implemented using regular functions rather than class constructors.

## Requirements

- Node.js 18+ (tested on Node.js 26+)
- npm

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Configure environment variables in `.env`:
   ```bash
   cp .env.example .env
   ```

   Edit `.env` as needed:
   ```env
   PORT=3000
   OPENAI_API_KEY=your-api-key-here
   OPENAI_BASE_URL=https://api.openai.com/v1
   OPENAI_MODEL=gpt-4o-mini
   ```

   > **Note for Local / Custom LLM Endpoints (e.g. Ollama, vLLM):**
   > - For Ollama: Set `OPENAI_BASE_URL=http://localhost:11434/v1`, `OPENAI_MODEL=llama3.1` (or your loaded model), and `OPENAI_API_KEY=dummy-key`.

## Running the Server

Start the server:
```bash
npm start
```

Default server port is `3000`.

## Running Tests

Run the automated test suite:
```bash
npm test
```

## API Usage

### Endpoint: `POST /api/schedule`

#### Request Body
```json
{
  "message": "Schedule a project review with Aditya tomorrow at 3 PM for 45 minutes."
}
```

#### Example cURL
```bash
curl -X POST http://localhost:3000/api/schedule \
  -H "Content-Type: application/json" \
  -d '{"message": "Schedule a project review with Aditya tomorrow at 3 PM for 45 minutes."}'
```

#### Successful Response (`200 OK`)
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

#### Error Response (`400 Bad Request`)
```json
{
  "success": false,
  "error": "Field 'message' is required and must be a non-empty string."
}
```
