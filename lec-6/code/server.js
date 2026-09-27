import "dotenv/config";
import express from "express";
import cors from "cors";
import OpenAI from "openai";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read configuration from environment variables
const apiKey = (process.env.OPENAI_API_KEY || process.env.OPENAI_APIKEY || "not-needed").trim();
const baseURL = (process.env.OPENAI_BASE_URL || process.env.OPENAI_ENDPOINT || "").trim();
const model = (process.env.OPENAI_MODEL || "gpt-4o-mini").trim();
const systemPrompt = process.env.SYSTEM_PROMPT || "You are a helpful and funny AI chatbot for Tomato Support. You reply with witty and helpful answers.";
const port = process.env.PORT || 3000;

// Initialize OpenAI client compatible with OpenAI, Groq, Ollama, OpenRouter, LM Studio, etc.
const openai = new OpenAI({
  apiKey,
  ...(baseURL ? { baseURL } : {}),
});

// Simple conversation history array (no OOP/classes needed)
const history = [];

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.text({ type: "*/*" }));

// Serve frontend from public directory
app.use(express.static(path.join(__dirname, "public")));

// Streaming chat endpoint
app.post("/api/chat", async (req, res) => {
  const message = (typeof req.body === "string" ? req.body : req.body?.message || "").trim();

  if (!message) {
    return res.status(400).send("Message cannot be empty");
  }

  history.push({ role: "user", content: message });

  // Response headers to enable real-time chunked streaming
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Transfer-Encoding", "chunked");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");

  try {
    const stream = await openai.chat.completions.create({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        ...history,
      ],
      stream: true,
    });

    let fullReply = "";

    for await (const chunk of stream) {
      const token = chunk.choices?.[0]?.delta?.content || "";
      if (token) {
        fullReply += token;
        res.write(token);
      }
    }

    history.push({ role: "assistant", content: fullReply });
    res.end();
  } catch (error) {
    console.error("Streaming error:", error);
    if (!res.headersSent) {
      res.status(500).send(error.message || "Error generating response");
    } else {
      res.end();
    }
  }
});

// Endpoint to clear conversation history
app.post("/api/clear", (_req, res) => {
  history.length = 0;
  res.json({ ok: true, message: "History cleared" });
});

const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isDirectRun) {
  app.listen(port, () => {
    console.log(`Tomato Support AI running at http://localhost:${port}`);
    console.log(`Using model: ${model}${baseURL ? ` at ${baseURL}` : ""}`);
  });
}

export default app;
