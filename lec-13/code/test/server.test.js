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
