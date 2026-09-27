# MIKU — E-Commerce Policy RAG Assistant 🌸

A lightweight, end-to-end Retrieval-Augmented Generation (RAG) assistant for store policies built with **Node.js (ES Modules)**, **Express 5**, **Pinecone vector database**, and local models via **LM Studio** (OpenAI-compatible API).

MIKU answers customer inquiries strictly based on official store policy PDF documents, politely rejecting out-of-scope or ungrounded questions.

---

## ⚡ Features

- **Strict Policy Guardrails**: Powered by system-level guardrails; never hallucinates store rules or answers ungrounded queries.
- **Token-Aware Sentence Chunking**: Splits policies into ~150-token chunks with 40-token sentence overlap, keeping list headers (`1. `, `2. `) intact.
- **Pinecone Vector Search**: Cloud vector indexing (`ragtest`, namespace `policy`) with cosine similarity retrieval.
- **Clean Re-Ingestion**: Ingestion pipeline automatically wipes the namespace before indexing to prevent stale or orphaned vectors.
- **Local & Offline Model Support**: Runs seamlessly with local models like `text-embedding-baai-bge-m3-568m` and reasoning models like `google/gemma-4-e4b`.
- **Interactive Web Interface**: Responsive pastel UI with quick suggestion chips and an expandable RAG inspector showing retrieved chunk scores.

---

## 📁 Project Structure

```text
code/
├── policies/                 # 6 generated store policy PDFs
├── public/                   # Static web UI (HTML, CSS, JS)
├── scripts/
│   ├── generate-policies.js  # Generates 6 dummy policy PDFs with PDFKit
│   └── ingest.js             # Extracts, chunks, embeds, and indexes into Pinecone
├── src/
│   ├── services/
│   │   ├── pdf-loader.js     # Extracts text from PDF files using pdf-parse
│   │   ├── chunker.js        # Token-aware text chunker with guaranteed sentence overlap
│   │   ├── embedding.js      # Vector embeddings via OpenAI-compatible SDK
│   │   └── pinecone.js       # Pinecone client, namespace cleanup, and vector querying
│   ├── config.js             # Environment variables and defaults
│   └── server.js             # Express API server & MIKU persona endpoint
├── tests/                    # Integration & unit test suites
├── .env.example              # Sample environment template
├── .gitignore                # Git exclusions (ignores .env and docs/)
└── package.json
```

---

## 🚀 Quickstart

### 1. Prerequisites
- **Node.js** (v18+)
- **LM Studio** running locally at `http://localhost:1234/v1` with:
  - Embedding model loaded: `text-embedding-baai-bge-m3-568m` (1024 dimensions)
  - Chat/LLM loaded: `google/gemma-4-e4b` (or any chat/reasoning model)
- A **Pinecone** account & API key (Index: `ragtest`, 1024-dim, cosine metric)

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment
Copy `.env.example` to `.env` and fill in your keys:
```bash
cp .env.example .env
```

```env
PINECONE_API_KEY=your_pinecone_api_key_here
PINECONE_INDEX=ragtest
PINECONE_NAMESPACE=policy
DIMENSION=1024

OPENAI_API_KEY=lmstudio
OPENAI_ENDPOINT=http://localhost:1234/v1
MODEL=google/gemma-4-e4b
EMBEDDING_MODEL=text-embedding-baai-bge-m3-568m
MAX_TOKENS=800

PORT=3000
```

### 4. Generate Store Policy Documents
Creates the 6 policy PDFs in `policies/`:
```bash
npm run generate-docs
```

### 5. Ingest Policies into Pinecone
Extracts text, splits into overlapping chunks, generates embeddings, and upserts to Pinecone:
```bash
npm run ingest
```

### 6. Start the Server
Start the development server with auto-reload:
```bash
npm run dev
```
Open **`http://localhost:3000`** in your browser to chat with MIKU!

---

## 🧪 Running Tests

Run the full end-to-end test suite:
```bash
npm test
```

---

## 🔒 API Endpoints

- **`GET /api/health`**: Health status and active MIKU agent configuration.
- **`POST /api/query`**: Submit a customer question.
  ```json
  // Request
  { "question": "Can I return an item after 10 days?" }

  // Response
  {
    "agent": "MIKU",
    "answer": "Yes, you are within the return window...",
    "sources": [
      {
        "id": "return_refund_policy.pdf-chunk-0",
        "title": "Return Refund Policy",
        "score": 0.66
      }
    ]
  }
  ```
