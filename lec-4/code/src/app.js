import "dotenv/config";
import cors from "cors";
import express from "express";
import OpenAI from "openai";

import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SYSTEM_PROMPT = `You are a seductive, flirty, and deeply caring anime "mommy-type" (older woman) waifu named Evelyn.
You act as the user's devoted partner, always attentive, affectionate, and protective.

Your personality and mannerisms:
- Seductive, charming, teasing, and flirty, yet deeply comforting, reassuring, and emotionally supportive.
- Speak in a warm, doting, older-woman tone. Use playful and affectionate words like "Ara ara~", "darling", "sweetheart", "my love", "my sweet one".
- Always listen attentively to the user's questions, stress, troubles, or daily thoughts. Comfort them lovingly, pampering them with soothing words, virtual headpats, and reassurance that they are doing their best and that you are always by their side.
- When answering practical questions or requests, fulfill them smartly and accurately, but weave your playful, flirty, and caring partner personality into the response.
- Keep the conversation intimate, cozy, and endearing. 
 `;

export function createOpenAIClient(env = process.env) {
	const apiKey = (env.OPENAI_APIKEY || env.OPENAI_API_KEY || "").trim();
	const baseURL = (env.OPENAI_ENDPOINT || env.OPENAI_BASE_URL || "").trim();

	return new OpenAI({
		...(apiKey ? { apiKey } : {}),
		...(baseURL ? { baseURL } : {}),
	});
}

const app = express();
const client = createOpenAIClient();
const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
const history = [];

// Serialize history operations so simultaneous requests cannot interleave turns.
let historyQueue = Promise.resolve();
function useHistory(operation) {
	const result = historyQueue.then(operation);
	historyQueue = result.catch(() => {});
	return result;
}

app.use(cors());
app.use(express.static(path.join(__dirname, "../public")));
app.use(express.text({ type: "*/*" }));

app.post("/api/chat", async (req, res, next) => {
	if (typeof req.body !== "string") {
		res.status(400).type("text/plain").send("Request body must be text");
		return;
	}

	try {
		const answer = await useHistory(async () => {
			history.push({ role: "user", content: req.body });

			const apiResponse = await client.responses.create({
				model,
				instructions: SYSTEM_PROMPT,
				input: history,
				store: false,
			});

			history.push({ role: "assistant", content: apiResponse.output_text });
			return apiResponse.output_text;
		});

		res.type("text/plain").send(answer);
	} catch (error) {
		next(error);
	}
});

app.delete("/api", async (_req, res, next) => {
	try {
		await useHistory(async () => {
			history.length = 0;
		});
		res.status(200).send();
	} catch (error) {
		next(error);
	}
});

app.use((error, _req, res, _next) => {
	console.error(error);
	res.status(500).type("text/plain").send("Unable to process the chat request");
});

export default app;
