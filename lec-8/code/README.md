# Anime Recommendation System

A minimal, in-memory vector embedding recommendation engine built with **Node.js (ES Modules)** and **Express 5**. 

Uses cosine similarity to semantically match search queries and recommend similar anime without needing an external vector database.

---

## ⚡ Features

- **No Vector DB Required**: Stores 1024-dimensional embedding vectors directly in memory (`Array`).
- **Cosine Similarity**: Pure functional math implementation $\frac{A \cdot B}{\|A\| \|B\|}$ (no classes/OOP).
- **Flexible Providers**: Supports local models via **LM Studio** (`http://localhost:1234/v1`) or cloud models via **OpenRouter** using the OpenAI-compatible SDK.
- **Cached Embeddings**: Embeddings are generated once and cached to `data/embeddings.cache.json` for instant boot.
- **AniList Dataset**: Curated 50 popular anime with cleaned descriptions and cover images.
- **Static Web UI**: Built-in responsive UI served at `http://localhost:3000`.

---

## 📁 Project Structure

```text
code/
├── data/
│   ├── anime.json               # 50 anime records (titles, descriptions, images)
│   └── embeddings.cache.json    # Cached vector embeddings (1024-dim)
├── src/
│   ├── services/
│   │   ├── embeddingService.js  # OpenAI SDK client & batch embedding cache loader
│   │   └── recommendationService.js # Cosine similarity math & in-memory vector search
│   ├── controllers/
│   │   └── animeController.js   # Request/response handlers
│   ├── routes/
│   │   └── animeRoutes.js       # Express router definitions
│   └── index.js                 # Server entry point
├── public/                      # Static web interface (HTML/CSS/JS)
├── scripts/
│   └── fetchAniList.js          # Script to fetch 50 anime from AniList GraphQL API
├── .env.example
└── package.json
```

---

## 🚀 Quickstart

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment (`.env`)

Create a `.env` file in the `code/` directory:

#### Option A: Local Model with LM Studio (Recommended, Free & Offline)
1. In **LM Studio**, load an embedding model (e.g. `text-embedding-baai-bge-m3-568m` or `nomic-embed-text`).
2. Start the local server on port `1234`.
3. Set your `.env`:
```env
PORT=3000
OPENAI_BASE_URL=http://localhost:1234/v1
OPENROUTER_API_KEY=lm-studio
EMBEDDING_MODEL=text-embedding-baai-bge-m3-568m
```

#### Option B: Cloud with OpenRouter
```env
PORT=3000
OPENAI_BASE_URL=https://openrouter.ai/api/v1
OPENROUTER_API_KEY=your_openrouter_api_key_here
EMBEDDING_MODEL=liquid/lfm-2.5-embedding-350m:free
```

### 3. Run the Server

```bash
npm run dev
```

* **Web UI**: Open [http://localhost:3000](http://localhost:3000)
* **API**: [http://localhost:3000/api/anime](http://localhost:3000/api/anime)

---

## 🔌 API Endpoints

### 1. Semantic Search
Finds top 3 anime matching natural language query concepts.

* **POST** `/api/anime/search`
* **Body**:
  ```json
  {
    "query": "romantic comedy high school life"
  }
  ```
* **Response**:
  ```json
  {
    "success": true,
    "query": "romantic comedy high school life",
    "count": 3,
    "results": [
      {
        "title": "Toradora!",
        "similarity": 0.5341,
        "genres": ["Comedy", "Drama", "Romance", "Slice of Life"],
        "image": "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx4224-PXVMBLNwy2aF.jpg"
      }
    ]
  }
  ```
*(Also supports `GET /api/anime/search?q=romantic+comedy`)*

---

### 2. Similar Anime by Title
Finds top 3 similar anime using vector similarity (excluding the selected anime).

* **GET** `/api/anime/:title/similar`
* **Example**: `/api/anime/Steins;Gate/similar`
* **Response**:
  ```json
  {
    "success": true,
    "selected": {
      "title": "Steins;Gate",
      "image": "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx9253-tIUXF2gfU8Sg.jpg"
    },
    "recommendations": [
      {
        "title": "Dr. STONE",
        "similarity": 0.3581,
        "image": "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx105333-GybuoSoOZfpH.jpg"
      }
    ]
  }
  ```
*(Also supports alias route `/:title/simular`)*

---

### 3. Full Anime Catalog
Returns all 50 anime records with metadata.

* **GET** `/api/anime`

---

## 🛠️ Utility Scripts

To refresh the dataset with the latest top 50 anime from AniList GraphQL:

```bash
node scripts/fetchAniList.js
```
*(If changing embedding models, delete `data/embeddings.cache.json` and restart the server to re-embed).*
