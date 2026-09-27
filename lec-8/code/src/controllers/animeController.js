import {
	getAllAnime,
	getSimilarByTitle,
	searchByQuery,
} from "../services/recommendationService.js";

/**
 * Controller to fetch all anime in catalog
 */
export function getAnimeCatalog(_req, res) {
	try {
		const list = getAllAnime();
		return res.status(200).json({
			success: true,
			total: list.length,
			data: list,
		});
	} catch (error) {
		return res.status(500).json({
			success: false,
			error: error.message,
		});
	}
}

/**
 * Controller to search anime by semantic query using vector embeddings
 */
export async function searchAnime(req, res) {
	try {
		const query = req.body?.query || req.query?.q;
		const limit = parseInt(req.query?.limit, 10) || 3;

		if (!query) {
			return res.status(400).json({
				success: false,
				error:
					"Missing required parameter 'query' in body or 'q' in query string.",
			});
		}

		const results = await searchByQuery(query, limit);

		return res.status(200).json({
			success: true,
			query: query,
			limit: limit,
			count: results.length,
			results: results,
		});
	} catch (error) {
		const status = error.message.includes("API_KEY") ? 401 : 500;
		return res.status(status).json({
			success: false,
			error: error.message,
		});
	}
}

/**
 * Controller to find top 3 similar anime excluding the selected one
 */
export function getSimilarAnime(req, res) {
	try {
		const { title } = req.params;
		const limit = parseInt(req.query?.limit, 10) || 3;

		if (!title) {
			return res.status(400).json({
				success: false,
				error: "Missing anime title parameter.",
			});
		}

		const result = getSimilarByTitle(title, limit);

		return res.status(200).json({
			success: true,
			selected: result.selected,
			limit: limit,
			count: result.recommendations.length,
			recommendations: result.recommendations,
		});
	} catch (error) {
		const status = error.status || 500;
		return res.status(status).json({
			success: false,
			error: error.message,
		});
	}
}
