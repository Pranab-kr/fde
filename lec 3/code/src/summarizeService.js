import OpenAI from "openai";

const DEFAULT_MODEL = "gpt-5.6-luna";

export function createOpenAIClient(env = process.env) {
	const apiKey = (env.OPENAI_APIKEY || env.OPENAI_API_KEY || "").trim();
	const baseURL = (env.OPENAI_ENDPOINT || env.OPENAI_BASE_URL || "").trim();

	return new OpenAI({
		...(apiKey ? { apiKey } : {}),
		...(baseURL ? { baseURL } : {}),
	});
}

export function createSummarizeService({
	client = createOpenAIClient(),
	model = (process.env.OPENAI_MODEL || DEFAULT_MODEL).trim(),
} = {}) {
	return {
		async summarize(ticket) {
			if (client.chat?.completions?.create) {
				const response = await client.chat.completions.create({
					model,
					messages: [
						{
							role: "user",
							content: `Summarize this support ticket in 2 lines : \n\n${ticket}`,
						},
					],
				});

				const summary = response.choices?.[0]?.message?.content?.trim();
				if (!summary) {
					throw new Error("OpenAI returned an empty summary");
				}

				console.log("used completion");
				return summary;
			}

			if (client.responses?.create) {
				const response = await client.responses.create({
					model,
					input: `Summarize this support ticket in 2 lines : \n\n${ticket}`,
					store: false,
				});

				if (!response.output_text) {
					throw new Error("OpenAI returned an empty summary");
				}

				console.log("used the responses");
				return response.output_text;
			}

			throw new Error("No supported completion method found on OpenAI client");
		},
	};
}
