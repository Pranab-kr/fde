import { fetchEmbedding } from "./embeddingService.js";

// In-memory array storing all anime objects with their embedding vectors
let animeStore = [];

/**
 * Initialize the in-memory anime store
 * @param {Array<{ id: number, title: string, genres: string[], description: string, embedding: number[] }>} data
 */
export function initStore(data) {
  animeStore = data;
  console.log(`[Store] In-memory store ready with ${animeStore.length} anime entries.`);
}

/**
 * Get all anime in catalog (without embeddings to keep payload light)
 * @returns {Array<{ id: number, title: string, genres: string[], description: string }>}
 */
export function getAllAnime() {
  return animeStore.map(({ id, anilistId, title, genres, description, image }) => ({
    id,
    anilistId,
    title,
    genres,
    description,
    image
  }));
}

/**
 * Calculate cosine similarity between two numeric vectors
 * Formula: (A · B) / (||A|| * ||B||)
 * @param {number[]} a
 * @param {number[]} b
 * @returns {number} similarity score between -1 and 1
 */
export function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) {
    return 0;
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Search the catalog using a user query string
 * @param {string} queryText
 * @param {number} limit (default: 3)
 * @returns {Promise<Array<{ id: number, title: string, genres: string[], description: string, similarity: number }>>}
 */
export async function searchByQuery(queryText, limit = 3) {
  if (!queryText || !queryText.trim()) {
    throw new Error("Search query must not be empty.");
  }

  // 1. Generate embedding vector for the user search query
  const queryEmbedding = await fetchEmbedding(queryText.trim());

  // 2. Compute cosine similarity against all anime in memory
  const scoredMatches = animeStore.map((anime) => {
    const similarity = cosineSimilarity(queryEmbedding, anime.embedding);
    return {
      id: anime.id,
      anilistId: anime.anilistId,
      title: anime.title,
      genres: anime.genres,
      description: anime.description,
      image: anime.image,
      similarity: Number(similarity.toFixed(4))
    };
  });

  // 3. Sort descending by similarity score
  scoredMatches.sort((a, b) => b.similarity - a.similarity);

  // 4. Return top K results
  return scoredMatches.slice(0, limit);
}

/**
 * Find top similar anime for a given title, excluding the selected title
 * @param {string} title
 * @param {number} limit (default: 3)
 * @returns {{ selected: { title: string, description: string }, recommendations: Array<{ id: number, title: string, genres: string[], description: string, similarity: number }> }}
 */
export function getSimilarByTitle(title, limit = 3) {
  if (!title || !title.trim()) {
    throw new Error("Anime title parameter is required.");
  }

  const cleanTitle = title.trim().toLowerCase();

  // 1. Locate selected anime in memory
  const selectedAnime = animeStore.find(
    (anime) => anime.title.toLowerCase() === cleanTitle
  );

  if (!selectedAnime) {
    const error = new Error(`Anime with title '${title}' not found in catalog.`);
    error.status = 404;
    throw error;
  }

  // 2. Filter out the selected anime and compute similarity with all others
  const recommendations = animeStore
    .filter((anime) => anime.title.toLowerCase() !== cleanTitle)
    .map((anime) => {
      const similarity = cosineSimilarity(selectedAnime.embedding, anime.embedding);
      return {
        id: anime.id,
        anilistId: anime.anilistId,
        title: anime.title,
        genres: anime.genres,
        description: anime.description,
        image: anime.image,
        similarity: Number(similarity.toFixed(4))
      };
    });

  // 3. Sort descending by similarity score
  recommendations.sort((a, b) => b.similarity - a.similarity);

  // 4. Return top K recommendations
  return {
    selected: {
      id: selectedAnime.id,
      anilistId: selectedAnime.anilistId,
      title: selectedAnime.title,
      genres: selectedAnime.genres,
      description: selectedAnime.description,
      image: selectedAnime.image
    },
    recommendations: recommendations.slice(0, limit)
  };
}
