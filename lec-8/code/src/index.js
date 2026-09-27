import "dotenv/config";
import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import animeRoutes from "./routes/animeRoutes.js";
import { loadOrGenerateEmbeddings } from "./services/embeddingService.js";
import { initStore } from "./services/recommendationService.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend files from 'public' folder
const publicPath = path.join(__dirname, "../public");
app.use(express.static(publicPath));

// API Routes
app.use("/api/anime", animeRoutes);

// Health check endpoint
app.get("/health", (_req, res) => {
	res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Server Initialization
async function startServer() {
	try {
		console.log("====================================================");
		console.log("   Anime Vector Recommendation Engine Starting...   ");
		console.log("====================================================");

		// 1. Read anime dataset
		const datasetPath = path.join(__dirname, "../data/anime.json");
		if (!fs.existsSync(datasetPath)) {
			throw new Error(`Dataset not found at ${datasetPath}`);
		}

		const rawData = fs.readFileSync(datasetPath, "utf8");
		const animeList = JSON.parse(rawData);
		console.log(`[Init] Loaded ${animeList.length} anime from data/anime.json`);

		// 2. Fetch or load cached embeddings
		const animeWithEmbeddings = await loadOrGenerateEmbeddings(animeList);

		// 3. Initialize in-memory array store
		initStore(animeWithEmbeddings);

		// 4. Start HTTP Server
		app.listen(PORT, () => {
			console.log(`\n Server running on http://localhost:${PORT}`);
			console.log(` Web UI: http://localhost:${PORT}`);
			console.log(` API Endpoints for Postman:`);
			console.log(`   - GET  http://localhost:${PORT}/api/anime`);
			console.log(
				`   - POST http://localhost:${PORT}/api/anime/search  (body: { "query": "mind games and detectives" })`,
			);
			console.log(
				`   - GET  http://localhost:${PORT}/api/anime/Steins;Gate/similar`,
			);
		});
	} catch (error) {
		console.error("\n❌ Failed to start server:", error.message);
		console.error(
			"Please make sure your .env has a valid OPENROUTER_API_KEY.\n",
		);
		process.exit(1);
	}
}

startServer();
