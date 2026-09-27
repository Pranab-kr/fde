import { Router } from "express";
import {
	getAnimeCatalog,
	getSimilarAnime,
	searchAnime,
} from "../controllers/animeController.js";

const router = Router();

// 1. Get full catalog of 30 anime
router.get("/", getAnimeCatalog);

// 2. Semantic search by query (supports POST body or GET ?q=...)
router.post("/search", searchAnime);
router.get("/search", searchAnime);

// 3. Find top 3 similar anime by title (excluding the selected one)
// Supports both '/:title/similar' and '/:title/simular'
router.get("/:title/similar", getSimilarAnime);

export default router;
