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
