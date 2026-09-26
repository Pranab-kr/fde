import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_FILE = path.join(__dirname, "../data/anime.json");

const ANILIST_API_URL = "https://graphql.anilist.co";

const GRAPHQL_QUERY = `
query ($page: Int, $perPage: Int) {
  Page(page: $page, perPage: $perPage) {
    media(type: ANIME, sort: POPULARITY_DESC) {
      id
      title {
        english
        romaji
      }
      genres
      description
      coverImage {
        extraLarge
        large
        medium
      }
    }
  }
}
`;

/**
 * Strip HTML tags and markdown artifacts from description
 * @param {string} rawHtml
 * @returns {string}
 */
function cleanDescription(rawHtml) {
  if (!rawHtml) return "No description available.";
  return rawHtml
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchAniListTop50() {
  console.log("Fetching top 50 anime from AniList GraphQL API...");

  const response = await fetch(ANILIST_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json"
    },
    body: JSON.stringify({
      query: GRAPHQL_QUERY,
      variables: {
        page: 1,
        perPage: 50
      }
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`AniList API failed (${response.status}): ${errorText}`);
  }

  const result = await response.json();
  const mediaList = result.data?.Page?.media || [];

  console.log(`Received ${mediaList.length} anime entries from AniList.`);

  const formattedAnime = mediaList.map((item, index) => {
    const title = item.title?.english || item.title?.romaji || `Anime ${index + 1}`;
    const description = cleanDescription(item.description);
    const image = item.coverImage?.extraLarge || item.coverImage?.large || item.coverImage?.medium || "";

    return {
      id: index + 1,
      anilistId: item.id,
      title: title,
      genres: item.genres || [],
      description: description,
      image: image
    };
  });

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(formattedAnime, null, 2), "utf8");
  console.log(`✅ Successfully saved 50 anime with images and descriptions to ${OUTPUT_FILE}`);
}

fetchAniListTop50().catch((err) => {
  console.error("Error fetching from AniList:", err);
  process.exit(1);
});
