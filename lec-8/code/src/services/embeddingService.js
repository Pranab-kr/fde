import "dotenv/config";
import fs from "fs";
import OpenAI from "openai";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DEFAULT_MODEL = "liquid/lfm-2.5-embedding-350m:free";
const CACHE_FILE_PATH = path.join(
	__dirname,
	"../../data/embeddings.cache.json",
);

/**
 * Returns a configured OpenAI client instance using current env variables
 */
function getClient() {
	return new OpenAI({
		baseURL: process.env.OPENAI_BASE_URL || "http://localhost:1234/v1",
		apiKey: process.env.OPENROUTER_API_KEY || "lm-studio",
	});
}

/**
 * Fetch embeddings for an array of texts in a batch with retry logic using OpenAI SDK
 * @param {string[]} texts
 * @param {number} maxRetries
 * @returns {Promise<number[][]>} Array of embedding vectors
 */
export async function fetchEmbeddingsBatch(texts, maxRetries = 3) {
	/*
  // =========================================================================
  // [RAW FETCH IMPLEMENTATION - Commented out for reference]
  // =========================================================================
  const apiKey = process.env.OPENROUTER_API_KEY;
  const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/embeddings";
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const response = await fetch(OPENROUTER_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: process.env.EMBEDDING_MODEL || DEFAULT_MODEL,
        input: texts
      })
    });

    if (response.status === 429) {
      console.warn(`[Embedding] Rate limit (429) encountered. Retrying in 5s...`);
      await new Promise((resolve) => setTimeout(resolve, 5000));
      continue;
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenRouter API error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    const sorted = [...data.data].sort((a, b) => a.index - b.index);
    return sorted.map((item) => item.embedding);
  }
  // =========================================================================
  */

	const client = getClient();
	const model = process.env.EMBEDDING_MODEL || DEFAULT_MODEL;

	for (let attempt = 1; attempt <= maxRetries; attempt++) {
		try {
			const response = await client.embeddings.create({
				model: model,
				input: texts,
			});

			if (!response.data || !Array.isArray(response.data)) {
				throw new Error(
					`Invalid response format from embedding API: ${JSON.stringify(response)}`,
				);
			}

			// Sort by index to maintain original order
			const sorted = [...response.data].sort((a, b) => a.index - b.index);
			return sorted.map((item) => item.embedding);
		} catch (error) {
			if (error.status === 429 && attempt < maxRetries) {
				console.warn(
					`[Embedding] Rate limit (429) encountered. Retrying attempt ${attempt}/${maxRetries} in 5s...`,
				);
				await new Promise((resolve) => setTimeout(resolve, 5000));
				continue;
			}
			throw error;
		}
	}

	throw new Error("Exceeded maximum retries for embedding API.");
}

/**
 * Fetch vector embedding for a single text string
 * @param {string} text
 * @returns {Promise<number[]>}
 */
export async function fetchEmbedding(text) {
	const [embedding] = await fetchEmbeddingsBatch([text]);
	return embedding;
}

/**
 * Load embeddings from cache if available, or generate them in batches via OpenAI SDK and cache to disk
 * @param {Array<{ id: number, title: string, genres: string[], description: string }>} animeList
 * @returns {Promise<Array<{ id: number, title: string, genres: string[], description: string, embedding: number[] }>>}
 */
export async function loadOrGenerateEmbeddings(animeList) {
	// 1. Check local cache file
	if (fs.existsSync(CACHE_FILE_PATH)) {
		try {
			const cachedData = JSON.parse(fs.readFileSync(CACHE_FILE_PATH, "utf8"));
			if (Array.isArray(cachedData) && cachedData.length === animeList.length) {
				console.log(
					`[Embedding] Loaded all ${cachedData.length} anime embeddings from local cache.`,
				);
				return cachedData;
			}
		} catch (err) {
			console.warn(
				"[Embedding] Cache file read error, will regenerate:",
				err.message,
			);
		}
	}

	// 2. Cache miss: Generate embeddings via OpenAI SDK in batches
	console.log(
		`[Embedding] Generating embeddings for ${animeList.length} anime in batches...`,
	);
	const BATCH_SIZE = 15;
	const animeWithEmbeddings = [];

	for (let i = 0; i < animeList.length; i += BATCH_SIZE) {
		const chunk = animeList.slice(i, i + BATCH_SIZE);
		const chunkDescriptions = chunk.map((anime) => anime.description);

		console.log(
			`[Embedding] Batch ${i / BATCH_SIZE + 1}: processing ${chunk.length} anime (${chunk.map((a) => a.title).join(", ")})...`,
		);
		const embeddings = await fetchEmbeddingsBatch(chunkDescriptions);

		for (let j = 0; j < chunk.length; j++) {
			animeWithEmbeddings.push({
				...chunk[j],
				embedding: embeddings[j],
			});
		}

		if (i + BATCH_SIZE < animeList.length) {
			// Small pause between batches
			await new Promise((resolve) => setTimeout(resolve, 500));
		}
	}

	// 3. Save to cache file
	try {
		fs.writeFileSync(
			CACHE_FILE_PATH,
			JSON.stringify(animeWithEmbeddings, null, 2),
			"utf8",
		);
		console.log(
			`[Embedding] Successfully cached ${animeWithEmbeddings.length} embeddings to ${CACHE_FILE_PATH}`,
		);
	} catch (err) {
		console.error("[Embedding] Failed to write cache file:", err.message);
	}

	return animeWithEmbeddings;
}
