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
