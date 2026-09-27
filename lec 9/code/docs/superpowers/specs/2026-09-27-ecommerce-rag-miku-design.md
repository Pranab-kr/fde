# Design Document: E-Commerce Policy RAG Assistant ("MIKU")

- **Date:** 2026-09-27
- **Project:** Mini RAG & Vector Embedding System with Pinecone & Local Models
- **Agent Persona:** MIKU (a soft, polite, helpful female customer support agent)

---

## 1. Overview & Goals
The goal of this mini-project is to build and demonstrate an end-to-end Retrieval-Augmented Generation (RAG) system for an e-commerce store. 

Key concepts explored:
1. **Document Ingestion & Chunking**: Parsing PDF store policies and splitting text into ~300-token chunks with 30-token overlap.
2. **Local Vector Embeddings**: Generating 1024-dimensional dense vectors using a locally hosted embedding model (`text-embedding-baai-bge-m3-568m` on LM Studio via OpenAI-compatible endpoint).
3. **Vector Database Indexing & Cosine Similarity**: Upserting chunk vectors and metadata into Pinecone index `ragtest` under namespace `policy`, queried with cosine similarity.
4. **Context Injection & LLM Guardrails**: Injecting top 5 retrieved policy chunks into the system prompt of a local LLM (`liquid/lfm2-1.2b`), strictly instructing MIKU to answer policy questions and reject ungrounded/out-of-domain requests with: *"I don't have the information you are asking for. Please check our store policies or contact customer support."*
5. **No Context History**: Processing single-turn queries without stateful conversation history.
6. **Web Interface**: Express-served static HTML/CSS/JS frontend in `public/` displaying the chat with MIKU and an educational drawer showing retrieved policy chunks and similarity scores.

---

## 2. System Architecture

```
                       +----------------------------------+
                       |        policies/*.pdf            |
                       | (6 Dummy E-commerce Store Docs)  |
                       +-----------------+----------------+
                                         |
                                         v
                       +----------------------------------+
                       |  scripts/ingest.js               |
                       |  - PDF text extraction           |
                       |  - ~300 token chunking           |
                       +-----------------+----------------+
                                         |
                       +-----------------+----------------+
                       | Local Embedding Endpoint         |
                       | (LM Studio: bge-m3-568m, 1024-d) |
                       +-----------------+----------------+
                                         |
                                         v
                       +----------------------------------+
                       | Pinecone Vector DB               |
                       | Index: ragtest, Metric: cosine   |
                       | Namespace: policy                |
                       +-----------------+----------------+
                                         ^
                                         | Cosine Match (top 5)
                                         |
[User] <--> [Web UI (public/)] <--> [Express /api/query]
                                         |
                                         v
                       +----------------------------------+
                       | Local LLM (LM Studio: lfm2-1.2b) |
                       | System Prompt + Context + Query  |
                       +----------------------------------+
```

---

## 3. Detailed Component Specifications

### 3.1 Policy Document Generation (`scripts/generate-policies.js`)
Using `pdfkit`, generates 6 e-commerce policy documents saved in `policies/`:
1. `return_refund_policy.pdf`: 30-day return window, condition requirements, return shipping fees, refund processing timelines (5-7 business days).
2. `shipping_delivery_policy.pdf`: Standard (3-5 days), Expedited (1-2 days), International delivery, free shipping thresholds over $50, carrier details.
3. `privacy_cookie_policy.pdf`: Data collection, cookie management, user rights, data encryption standards.
4. `terms_of_service.pdf`: User accounts, acceptable use, payment gateway terms, intellectual property, governing laws.
5. `warranty_repairs_policy.pdf`: 1-year limited manufacturer warranty, defect coverage vs wear-and-tear exclusions, claim submission process.
6. `cancellation_policy.pdf`: Order cancellation window (within 2 hours of placement before dispatch), automated vs manual cancellation procedures.

### 3.2 Chunking Service (`src/services/chunker.js`)
- **Target Size**: ~300 tokens (approx. 1,200 characters or ~225-300 words).
- **Overlap**: ~30 tokens (approx. 120 characters) between consecutive chunks to preserve contextual continuity.
- **Metadata**: Each chunk stores:
  - `id`: `${policySlug}-chunk-${index}`
  - `text`: Cleaned text chunk
  - `source`: PDF file name
  - `title`: Human-readable policy title
  - `chunkIndex`: Integer index within the document

### 3.3 Embedding Service (`src/services/embedding.js`)
- Interacts with LM Studio via OpenAI SDK:
  - Base URL: `process.env.OPENAI_ENDPOINT` (`http://localhost:1234/v1`)
  - API Key: `process.env.OPENAI_API_KEY` (`lmstudio`)
  - Model: `process.env.EMBEDDING_MODEL` (`text-embedding-baai-bge-m3-568m`)
- Functions:
  - `getEmbedding(text)`: Generates single 1024-dimension float vector.
  - `getEmbeddings(texts, batchSize = 10)`: Batched vector generation with error resilience.

### 3.4 Pinecone Vector Database Service (`src/services/pinecone.js`)
- Initializes `@pinecone-database/pinecone` client with `PINECONE_API_KEY`.
- Index: `ragtest` (retrieved from `process.env.PINDECONE_INDEX` or `process.env.PINECONE_INDEX`).
- Namespace: `process.env.PINECONE_NAMESPACE` (`policy`).
- Metric: `cosine` (pre-configured in Pinecone).
- Methods:
  - `upsertPolicyChunks(chunksWithVectors)`: Upserts in batches of 50.
  - `querySimilarChunks(queryVector, topK = 5)`: Returns top matches with cosine similarity scores and metadata.

### 3.5 Express Server & Query Endpoint (`src/server.js`)
- Serves static UI from `public/`.
- Routes:
  - `GET /api/health`: Health status of Pinecone & LM Studio.
  - `POST /api/query`:
    - Request body: `{ "question": "Can I return an item after 40 days?" }`
    - Steps:
      1. Embed user query using `getEmbedding(question)`.
      2. Query Pinecone vector index for top 5 matches in `policy` namespace.
      3. Construct prompt with MIKU persona and retrieved context.
      4. Call LM Studio chat completion with `liquid/lfm2-1.2b`.
      5. Return response JSON:
         ```json
         {
           "agent": "MIKU",
           "answer": "...",
           "sources": [
             {
               "title": "Return & Refund Policy",
               "fileName": "return_refund_policy.pdf",
               "score": 0.82,
               "text": "..."
             }
           ]
         }
         ```

### 3.6 Agent Persona & System Prompt Specification
```text
You are MIKU, a gentle, polite, and helpful female customer support assistant for our e-commerce store.
Always address the customer kindly and in a warm, respectful tone.

CRITICAL INSTRUCTIONS:
1. Answer the customer's question using ONLY the provided Policy Context below.
2. If the question cannot be answered using the provided context, or if the user asks something unrelated to our store policies, you MUST reply:
   "I'm sorry, but I don't have the information you are asking for. Please feel free to check our official store policies or reach out to our customer support team!"
3. Do NOT make up rules, dates, prices, or policies that are not explicitly stated in the context.
4. Keep your answer clear, accurate, and concise.

Policy Context:
---
${contextBlocks}
---
```

### 3.7 Frontend (`public/index.html`, `public/style.css`, `public/app.js`)
- Clean, aesthetic chat interface featuring MIKU's soft theme (pastel accents, avatar, welcoming greeting).
- Chat box with question input, sample suggested questions (e.g., "What is the return policy?", "How long does standard shipping take?", "What's the weather in Tokyo?").
- Expandable **"Retrieved Policy Context (RAG Inspector)"** beneath each assistant message, showing:
  - Retrieved chunk filename and policy title
  - Cosine similarity score (e.g. `Score: 0.842`)
  - Exact snippet text retrieved from Pinecone

---

## 4. Error Handling & Edge Cases
- **LM Studio Unreachable**: Returns HTTP 503 with friendly message notifying that the local model server is down.
- **Empty or Whitespace Query**: Returns HTTP 400 Bad Request.
- **Low Relevance / Out of Scope**: Pinecone returns matches, but system prompt guardrail ensures MIKU politely rejects questions lacking grounded evidence.
- **Missing Environment Variables**: Application fails fast on boot with helpful error message detailing missing `.env` fields.

---

## 5. Verification Plan
1. **Dependency Installation**: Verify `@pinecone-database/pinecone`, `pdfkit`, and `pdf-parse` install cleanly.
2. **Policy Generation**: Run `npm run generate-docs` and verify 6 PDF files exist in `policies/` with valid content.
3. **Ingestion Execution**: Run `npm run ingest` and verify:
   - PDFs are parsed.
   - Chunks are created (~300 tokens).
   - Vectors are created via local embedding model.
   - Records are upserted into Pinecone `policy` namespace.
4. **Endpoint & Guardrail Verification**:
   - Query in-scope: `"How many days do I have to return an item?"` -> Expect accurate answer citing 30 days and Return Policy.
   - Query in-scope: `"Do you offer free shipping?"` -> Expect accurate answer citing $50 threshold.
   - Query out-of-scope: `"What is the recipe for chocolate cake?"` -> Expect MIKU rejection fallback: *"I'm sorry, but I don't have the information you are asking for..."*
5. **UI Verification**: Load frontend in browser, verify chatting with MIKU and inspecting vector chunks.
