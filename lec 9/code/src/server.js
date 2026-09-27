import cors from "cors";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import config from "./config.js";
import { getEmbedding, openai } from "./services/embedding.js";
import { getPineconeIndex, querySimilarChunks } from "./services/pinecone.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "../public")));

const MIKU_SYSTEM_PROMPT = `You are MIKU, a soft, friendly, and polite female customer support assistant for our e-commerce store.
Always address the customer kindly, gently, and in a warm, welcoming tone.

CRITICAL POLICY GUARDRAILS:
1. Answer the customer's question using ONLY the provided Policy Context below.
2. If the user's question cannot be answered using the context, or if they ask about topics unrelated to our store policies (such as recipes, coding, world trivia, math, general chat), you MUST politely reply:
   "I'm sorry, but I don't have the information you are asking for. Please feel free to check our official store policies or reach out to our customer support team!"
3. Do NOT make up policies, dates, fees, or rules not explicitly mentioned in the context.
4. Keep your answer concise, soft-spoken, and helpful.`;

const GUARDRAIL_REPLY =
	"I'm sorry, but I don't have the information you are asking for. Please feel free to check our official store policies or reach out to our customer support team!";
const SIMILARITY_THRESHOLD = 0.45;

app.get("/api/health", async (_req, res) => {
	try {
		const index = getPineconeIndex();
		const stats = await index.describeIndexStats();
		res.json({
			status: "ok",
			agent: "MIKU",
			model: config.model,
			embeddingModel: config.embeddingModel,
			pineconeIndex: config.pineconeIndex,
			namespace: config.pineconeNamespace,
			stats,
		});
	} catch (err) {
		res.status(500).json({ status: "error", message: err.message });
	}
});

app.post("/api/query", async (req, res) => {
	const { question } = req.body || {};
	if (!question || typeof question !== "string" || !question.trim()) {
		return res
			.status(400)
			.json({ error: "Question is required and must be non-empty." });
	}

	try {
		// 1. Generate query embedding
		const queryVector = await getEmbedding(question);

		// 2. Query Pinecone for top 5 chunks using cosine similarity
		const matches = await querySimilarChunks(queryVector, 5);

		// Format retrieved sources
		const sources = matches.map((m) => ({
			id: m.id,
			title: m.metadata?.title,
			fileName: m.metadata?.source,
			score: m.score != null ? parseFloat(m.score.toFixed(4)) : null,
			text: m.metadata?.text,
		}));

		// Strict guardrails: if no matches found or relevance is below threshold, politely reject
		const topScore =
			matches.length > 0 && matches[0].score != null ? matches[0].score : 0;
		if (matches.length === 0 || topScore < SIMILARITY_THRESHOLD) {
			return res.json({
				agent: "MIKU",
				answer: GUARDRAIL_REPLY,
				sources,
			});
		}

		// 3. Format context blocks
		const contextBlocks = matches
			.map((m, idx) => {
				const scoreStr = m.score != null ? m.score.toFixed(3) : "N/A";
				return `[Policy Document ${idx + 1}: ${m.metadata?.title || "Unknown"} (${m.metadata?.source || "Unknown"}) | Score: ${scoreStr}]\n${m.metadata?.text || ""}`;
			})
			.join("\n\n");

		// 4. Construct prompt for local LLM
		const systemPromptWithContext = `${MIKU_SYSTEM_PROMPT}\n\nPolicy Context:\n---\n${contextBlocks}\n---`;

		const completion = await openai.chat.completions.create({
			model: config.model,
			messages: [
				{ role: "system", content: systemPromptWithContext },
				{ role: "user", content: question.trim() },
			],
			temperature: 0.2,
			max_tokens: 350,
		});

		const answer =
			completion.choices[0]?.message?.content?.trim() || GUARDRAIL_REPLY;

		res.json({
			agent: "MIKU",
			answer,
			sources,
		});
	} catch (err) {
		console.error("Query processing error:", err);
		res.status(500).json({
			error: "Failed to process query",
			details: err.message,
		});
	}
});

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	app.listen(config.port, () => {
		console.log(
			`🌸 MIKU E-Commerce RAG Assistant Server running on http://localhost:${config.port}`,
		);
	});
}

export default app;
export { app };
