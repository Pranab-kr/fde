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
const isDirectExecution = process.argv[1] && process.argv[1] === fileURLToPath(import.meta.url);
if (isDirectExecution) {
  const PORT = process.env.PORT || 3000;
  const app = createApp();
  app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
    console.log(`Model: ${DEFAULT_MODEL}`);
    console.log(`Base URL: ${process.env.OPENAI_BASE_URL || "Default OpenAI"}`);
  });
}
