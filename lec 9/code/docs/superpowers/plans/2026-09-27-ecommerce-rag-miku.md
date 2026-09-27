# E-Commerce Policy RAG Assistant ("MIKU") Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an end-to-end RAG mini-project using Express, local OpenAI-compatible embedding and LLM endpoints in LM Studio, Pinecone vector search with cosine similarity, and an interactive chat UI for a soft female assistant named "MIKU" who answers strictly based on e-commerce store policies.

**Architecture:** 
1. Ingestion CLI: Extracts text from 6 generated e-commerce policy PDFs in `policies/`, chunks into ~300 token segments with 30-token overlap, embeds via local `text-embedding-baai-bge-m3-568m` (1024-dim), and upserts to Pinecone index `ragtest` under namespace `policy`.
2. Retrieval & Generation: Express server exposes `POST /api/query`, generates query vector, retrieves top 5 chunks by cosine similarity, prompts local LLM `liquid/lfm2-1.2b` with strict groundedness instructions under persona "MIKU", returning grounded answer and source citations.
3. Frontend: Responsive HTML/CSS/JS chat UI in `public/` featuring MIKU's personality and an educational vector inspector drawer.

**Tech Stack:** Node.js, Express 5, `@pinecone-database/pinecone`, `openai`, `pdfkit`, `pdf-parse`, `dotenv`, vanilla HTML/CSS/JS.

**Spec:** `docs/superpowers/specs/2026-09-27-ecommerce-rag-miku-design.md`

## Global Constraints
- Target directory: `/home/pranab/play/fda/lec 9/code`
- Local OpenAI Endpoint: `http://localhost:1234/v1`
- Embedding Model: `text-embedding-baai-bge-m3-568m` (1024 dimensions)
- Chat Model: `liquid/lfm2-1.2b`
- Pinecone Index: `ragtest` (metric: `cosine`)
- Pinecone Namespace: `policy`
- Agent Persona: Soft female customer support assistant named "MIKU"
- Strict fallback response for out-of-scope or ungrounded questions:
  *"I'm sorry, but I don't have the information you are asking for. Please feel free to check our official store policies or reach out to our customer support team!"*
- No conversational history tracking (single-turn RAG)
- Module system: CommonJS (`"type": "commonjs"`)

---

### Task 1: Environment Configuration & Dependencies Setup

**Files:**
- Modify: `package.json`
- Create: `src/config.js`
- Test: `tests/config.test.js`

**Interfaces:**
- Consumes: `.env` environment variables (`PINECONE_API_KEY`, `OPENAI_ENDPOINT`, `OPENAI_API_KEY`, `MODEL`, `EMBEDDING_MODEL`, `DIMENSION`, `PINDECONE_INDEX`/`PINECONE_INDEX`, `PINECONE_NAMESPACE`, `PORT`)
- Produces: `config` object exported from `src/config.js` with validated fields:
  ```js
  module.exports = {
    port: number,
    pineconeApiKey: string,
    pineconeIndex: string,
    pineconeNamespace: string,
    openaiEndpoint: string,
    openaiApiKey: string,
    model: string,
    embeddingModel: string,
    dimension: number
  };
  ```

- [ ] **Step 1: Write the failing test for configuration module**

```javascript
// tests/config.test.js
const assert = require('assert');

function run() {
  const config = require('../src/config');
  assert.strictEqual(typeof config.pineconeApiKey, 'string');
  assert.ok(config.pineconeApiKey.length > 0, 'PINECONE_API_KEY should not be empty');
  assert.strictEqual(config.pineconeIndex, 'ragtest');
  assert.strictEqual(config.pineconeNamespace, 'policy');
  assert.strictEqual(config.dimension, 1024);
  assert.strictEqual(config.embeddingModel, 'text-embedding-baai-bge-m3-568m');
  assert.strictEqual(config.model, 'liquid/lfm2-1.2b');
  assert.strictEqual(config.openaiEndpoint, 'http://localhost:1234/v1');
  console.log('Task 1 config test passed');
}

run();
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tests/config.test.js`
Expected: FAIL with `MODULE_NOT_FOUND` (Cannot find module '../src/config')

- [ ] **Step 3: Install dependencies and implement config module**

Install:
```bash
npm install @pinecone-database/pinecone@^6.1.4 pdfkit@^0.17.2 pdf-parse@^1.1.1
```

Create `src/config.js`:
```javascript
require('dotenv').config();

const config = {
  port: parseInt(process.env.PORT, 10) || 3000,
  pineconeApiKey: process.env.PINECONE_API_KEY || '',
  pineconeIndex: process.env.PINECONE_INDEX || process.env.PINDECONE_INDEX || 'ragtest',
  pineconeNamespace: process.env.PINECONE_NAMESPACE || 'policy',
  openaiEndpoint: process.env.OPENAI_ENDPOINT || 'http://localhost:1234/v1',
  openaiApiKey: process.env.OPENAI_API_KEY || 'lmstudio',
  model: process.env.MODEL || 'liquid/lfm2-1.2b',
  embeddingModel: process.env.EMBEDDING_MODEL || 'text-embedding-baai-bge-m3-568m',
  dimension: parseInt(process.env.DIMENSION, 10) || 1024,
};

if (!config.pineconeApiKey) {
  throw new Error('PINECONE_API_KEY is required in environment variables');
}

module.exports = config;
```

Update `package.json` scripts:
```json
"scripts": {
  "start": "node src/server.js",
  "generate-docs": "node scripts/generate-policies.js",
  "ingest": "node scripts/ingest.js",
  "test": "node tests/config.test.js && node tests/chunker.test.js && node tests/services.test.js"
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node tests/config.test.js`
Expected: PASS ("Task 1 config test passed")

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json src/config.js tests/config.test.js
git commit -m "feat: setup project dependencies and centralized config"
```

---

### Task 2: Policy PDF Documents Generator

**Files:**
- Create: `scripts/generate-policies.js`
- Output: `policies/*.pdf` (6 PDF files)
- Test: `tests/policies-gen.test.js`

**Interfaces:**
- Consumes: `pdfkit`, `fs`, `path`
- Produces: 6 PDF documents in `/home/pranab/play/fda/lec 9/code/policies/`:
  1. `return_refund_policy.pdf`
  2. `shipping_delivery_policy.pdf`
  3. `privacy_cookie_policy.pdf`
  4. `terms_of_service.pdf`
  5. `warranty_repairs_policy.pdf`
  6. `cancellation_policy.pdf`

- [ ] **Step 1: Write test to verify generated policies**

```javascript
// tests/policies-gen.test.js
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const expectedFiles = [
  'return_refund_policy.pdf',
  'shipping_delivery_policy.pdf',
  'privacy_cookie_policy.pdf',
  'terms_of_service.pdf',
  'warranty_repairs_policy.pdf',
  'cancellation_policy.pdf',
];

const policiesDir = path.join(__dirname, '../policies');
assert.ok(fs.existsSync(policiesDir), 'policies directory should exist');

for (const file of expectedFiles) {
  const filePath = path.join(policiesDir, file);
  assert.ok(fs.existsSync(filePath), `File ${file} should exist`);
  const stat = fs.statSync(filePath);
  assert.ok(stat.size > 1000, `File ${file} should be non-empty (was ${stat.size} bytes)`);
}

console.log('Task 2 policies generation test passed');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tests/policies-gen.test.js`
Expected: FAIL (`policies directory should exist` or file missing)

- [ ] **Step 3: Implement policy generator script**

Create `scripts/generate-policies.js`:
```javascript
const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

const policies = [
  {
    fileName: 'return_refund_policy.pdf',
    title: 'Return and Refund Policy',
    sections: [
      {
        heading: '1. Standard Return Window',
        body: 'Customers have exactly 30 calendar days from the delivery date to return eligible items for a full refund or exchange. Items must be postmarked before the 30-day window expires. After 30 days, returns are strictly ineligible for refund or store credit.'
      },
      {
        heading: '2. Item Condition Requirements',
        body: 'Returned merchandise must be completely unused, unworn, unwashed, and in its original retail packaging with all manufacturer tags intact. Proof of purchase or original order confirmation receipt is required with every return package.'
      },
      {
        heading: '3. Return Shipping Costs',
        body: 'Standard returns for customer remorse or sizing issues incur a flat $5.99 return shipping fee deducted from the final refund. If the return is due to a warehouse mistake, defective product, or transit damage, return shipping is completely free.'
      },
      {
        heading: '4. Refund Processing Timeline',
        body: 'Once our warehouse receives and inspects the return (typically 2-3 business days), refunds are issued to the original payment method within 5 to 7 business days. Banks and credit card issuers may take an additional 3-5 business days to post the balance.'
      }
    ]
  },
  {
    fileName: 'shipping_delivery_policy.pdf',
    title: 'Shipping and Delivery Policy',
    sections: [
      {
        heading: '1. Shipping Methods and Delivery Speeds',
        body: 'We provide Standard Shipping (3 to 5 business days), Expedited Shipping (2 business days), and Next-Day Priority Delivery. Orders placed before 1:00 PM EST Monday through Friday are processed and dispatched on the same business day.'
      },
      {
        heading: '2. Free Shipping Eligibility',
        body: 'Standard shipping is free on all orders with a subtotal exceeding $50.00 within the contiguous United States before taxes and after discounts. Orders under $50.00 are charged a flat standard shipping rate of $6.50.'
      },
      {
        heading: '3. Carrier Tracking and Notifications',
        body: 'Every shipment is tracked via UPS, FedEx, or USPS. An automated shipping confirmation email containing the real-time tracking number is sent when the order leaves our logistics center.'
      },
      {
        heading: '4. International Shipping & Customs',
        body: 'We ship internationally to over 45 supported countries. International delivery takes 7 to 15 business days. Customers are responsible for all applicable import tariffs, VAT, and customs clearance charges.'
      }
    ]
  },
  {
    fileName: 'privacy_cookie_policy.pdf',
    title: 'Privacy and Cookie Policy',
    sections: [
      {
        heading: '1. Personal Information Collection',
        body: 'We collect customer contact details, shipping addresses, payment details processed via PCI-DSS Level 1 compliant gateways, and browsing telemetry solely to provide order fulfillment, customer support, and tailored recommendations.'
      },
      {
        heading: '2. Use of Cookies and Tracking',
        body: 'Our store utilizes functional cookies to maintain shopping cart sessions, analytical cookies to evaluate site traffic, and marketing cookies. Customers may disable non-essential cookies at any time through our Privacy Preference Center.'
      },
      {
        heading: '3. Data Retention and Deletion Rights',
        body: 'Under GDPR and CCPA, customers have the legal right to request access to, correction of, or permanent deletion of their personal records. Data deletion requests are processed within 30 days upon email verification to privacy@store.com.'
      },
      {
        heading: '4. Security and Data Protection',
        body: 'All transactional communications are encrypted using Transport Layer Security (TLS 1.3). We never sell, lease, or rent customer personal data to third-party marketing firms.'
      }
    ]
  },
  {
    fileName: 'terms_of_service.pdf',
    title: 'Terms of Service',
    sections: [
      {
        heading: '1. Account Registration and Security',
        body: 'Users must be at least 18 years old or possess legal guardian consent to register an account. Account owners are solely responsible for maintaining credentials secrecy and all activity executed under their profile.'
      },
      {
        heading: '2. Pricing, Availability, and Order Acceptance',
        body: 'All prices are shown in USD and are subject to real-time adjustments without notice. We reserve the right to decline or cancel any order flagged for potential fraud or containing clerical pricing discrepancies.'
      },
      {
        heading: '3. Intellectual Property Rights',
        body: 'All brand graphics, product descriptions, interface designs, audio, and proprietary code featured on this site are the exclusive property of the store and protected under international copyright and trademark legislation.'
      },
      {
        heading: '4. Dispute Resolution & Governing Law',
        body: 'These Terms are governed by and construed in accordance with the laws of the State of Delaware. Any disputes arising from transactions will be resolved through binding individual arbitration rather than court litigation.'
      }
    ]
  },
  {
    fileName: 'warranty_repairs_policy.pdf',
    title: 'Warranty and Repairs Policy',
    sections: [
      {
        heading: '1. One-Year Limited Manufacturer Warranty',
        body: 'All electronic hardware and durable goods sold directly by our store include a complimentary 1-year limited warranty against factory defects in materials and craftsmanship, effective starting from the delivery date.'
      },
      {
        heading: '2. Exclusions from Warranty Coverage',
        body: 'The warranty explicitly excludes accidental physical damage, water submersion, cosmetic wear-and-tear, battery degradation from normal usage, unauthorized repairs, or unauthorized third-party hardware modifications.'
      },
      {
        heading: '3. Warranty Claim Process',
        body: 'To file a claim, email support@store.com with your order number, clear photographs or videos of the defect, and a detailed description. If verified, we will issue a prepaid return label and ship a replacement or repaired unit within 7 business days.'
      }
    ]
  },
  {
    fileName: 'cancellation_policy.pdf',
    title: 'Order Cancellation Policy',
    sections: [
      {
        heading: '1. Instant Cancellation Window',
        body: 'Customers can self-cancel an order directly from their account dashboard within 2 hours of order placement. Full refunds for self-cancelled orders are triggered instantly back to the original payment method.'
      },
      {
        heading: '2. Orders Already Dispatched',
        body: 'Once an order has been marked as shipped or dispatched to the carrier warehouse (even if within 2 hours), it cannot be cancelled. The customer must wait for delivery and follow our standard 30-day Return and Refund Policy.'
      },
      {
        heading: '3. Custom and Personalized Items',
        body: 'Custom-made, engraved, or personalized merchandise cannot be cancelled once production commences (typically 1 hour post-order), as these goods cannot be returned to general inventory.'
      }
    ]
  }
];

const targetDir = path.join(__dirname, '../policies');
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

function generatePDF(policy) {
  return new Promise((resolve, reject) => {
    const filePath = path.join(targetDir, policy.fileName);
    const doc = new PDFDocument({ margin: 50 });
    const stream = fs.createWriteStream(filePath);

    doc.pipe(stream);

    // Title
    doc.fontSize(22).fillColor('#1A202C').text(policy.title, { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor('#718096').text('Official E-Commerce Store Policy Document', { align: 'center' });
    doc.moveDown(1.5);

    // Sections
    for (const section of policy.sections) {
      doc.fontSize(14).fillColor('#2B6CB0').text(section.heading);
      doc.moveDown(0.3);
      doc.fontSize(11).fillColor('#2D3748').text(section.body, { lineGap: 4 });
      doc.moveDown(1);
    }

    doc.end();
    stream.on('finish', () => resolve(filePath));
    stream.on('error', reject);
  });
}

async function main() {
  console.log(`Generating ${policies.length} policy PDFs in ${targetDir}...`);
  for (const policy of policies) {
    const p = await generatePDF(policy);
    console.log(`- Created ${path.basename(p)}`);
  }
  console.log('Policy generation complete.');
}

if (require.main === module) {
  main().catch(err => {
    console.error('Failed to generate policies:', err);
    process.exit(1);
  });
}

module.exports = { policies, generatePDF };
```

Run: `node scripts/generate-policies.js`

- [ ] **Step 4: Run test to verify it passes**

Run: `node tests/policies-gen.test.js`
Expected: PASS ("Task 2 policies generation test passed")

- [ ] **Step 5: Commit**

```bash
git add scripts/generate-policies.js tests/policies-gen.test.js
git commit -m "feat: add policy documents generator script and tests"
```

---

### Task 3: PDF Extraction & Token-Aware Chunking Service

**Files:**
- Create: `src/services/pdf-loader.js`
- Create: `src/services/chunker.js`
- Test: `tests/chunker.test.js`

**Interfaces:**
- Consumes: `pdf-parse`, raw text
- Produces:
  - `loadPdf(filePath)`: Promise<{ text: string, numPages: number }>
  - `loadAllPolicies(dirPath)`: Promise<Array<{ fileName: string, title: string, text: string }>>
  - `chunkText(text, metadata, options)`: Array<{ id: string, text: string, title: string, source: string, chunkIndex: number, tokenCount: number }>

- [ ] **Step 1: Write the failing test for PDF loading & chunking**

```javascript
// tests/chunker.test.js
const assert = require('assert');
const path = require('path');
const { chunkText, estimateTokens } = require('../src/services/chunker');
const { loadPdf } = require('../src/services/pdf-loader');

async function testChunker() {
  const sampleText = `Section 1. Return Window. Customers have 30 days to return. `.repeat(40);
  const metadata = { fileName: 'return_refund_policy.pdf', title: 'Return Policy' };
  
  const chunks = chunkText(sampleText, metadata, { targetChunkTokens: 100, overlapTokens: 20 });
  assert.ok(chunks.length > 1, 'Should split long text into multiple chunks');
  assert.strictEqual(chunks[0].source, 'return_refund_policy.pdf');
  assert.strictEqual(chunks[0].title, 'Return Policy');
  assert.strictEqual(chunks[0].chunkIndex, 0);
  assert.ok(chunks[0].id.includes('return_refund_policy.pdf-chunk-0'));
  assert.ok(chunks[0].tokenCount > 0);

  // Test loading actual generated PDF
  const pdfPath = path.join(__dirname, '../policies/return_refund_policy.pdf');
  const loaded = await loadPdf(pdfPath);
  assert.ok(loaded.text.length > 100, 'Loaded PDF should contain extracted text');
  assert.ok(loaded.text.includes('30 calendar days'), 'Extracted text should contain policy content');

  console.log('Task 3 chunker & pdf-loader test passed');
}

testChunker().catch(err => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tests/chunker.test.js`
Expected: FAIL (`Cannot find module '../src/services/chunker'`)

- [ ] **Step 3: Implement pdf-loader and chunker**

Create `src/services/pdf-loader.js`:
```javascript
const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');

async function loadPdf(filePath) {
  const dataBuffer = fs.readFileSync(filePath);
  const data = await pdfParse(dataBuffer);
  return {
    text: data.text.trim(),
    numPages: data.numpages,
    info: data.info,
  };
}

async function loadAllPolicies(dirPath) {
  const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.pdf'));
  const results = [];

  for (const file of files) {
    const fullPath = path.join(dirPath, file);
    const parsed = await loadPdf(fullPath);
    const title = file
      .replace('.pdf', '')
      .split('_')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');

    results.push({
      fileName: file,
      title,
      text: parsed.text,
    });
  }

  return results;
}

module.exports = { loadPdf, loadAllPolicies };
```

Create `src/services/chunker.js`:
```javascript
/**
 * Approximates token count based on whitespace and words (approx 0.75 words per token or ~4 chars/token).
 */
function estimateTokens(text) {
  if (!text) return 0;
  const words = text.trim().split(/\s+/).filter(Boolean);
  return Math.ceil(words.length * 1.3);
}

/**
 * Splits text into ~300 token chunks with configurable overlap.
 * Uses sentence/paragraph boundaries where possible to avoid cutting mid-sentence.
 */
function chunkText(text, metadata = {}, options = {}) {
  const targetTokens = options.targetChunkTokens || 300;
  const overlapTokens = options.overlapTokens || 30;

  // Split into sentences / paragraphs
  const sentences = text
    .split(/(?<=[.!?\n])\s+/)
    .map(s => s.trim())
    .filter(Boolean);

  const chunks = [];
  let currentSentences = [];
  let currentTokens = 0;

  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i];
    const sentenceTokens = estimateTokens(sentence);

    if (currentTokens + sentenceTokens > targetTokens && currentSentences.length > 0) {
      const chunkContent = currentSentences.join(' ');
      chunks.push({
        id: `${metadata.fileName || 'doc'}-chunk-${chunks.length}`,
        text: chunkContent,
        title: metadata.title || 'Store Policy',
        source: metadata.fileName || 'unknown.pdf',
        chunkIndex: chunks.length,
        tokenCount: estimateTokens(chunkContent),
      });

      // Keep overlapping tail sentences
      const overlapSentences = [];
      let overlapCount = 0;
      for (let j = currentSentences.length - 1; j >= 0; j--) {
        const tokens = estimateTokens(currentSentences[j]);
        if (overlapCount + tokens <= overlapTokens) {
          overlapSentences.unshift(currentSentences[j]);
          overlapCount += tokens;
        } else {
          break;
        }
      }

      currentSentences = overlapSentences;
      currentTokens = overlapCount;
    }

    currentSentences.push(sentence);
    currentTokens += sentenceTokens;
  }

  if (currentSentences.length > 0) {
    const chunkContent = currentSentences.join(' ');
    chunks.push({
      id: `${metadata.fileName || 'doc'}-chunk-${chunks.length}`,
      text: chunkContent,
      title: metadata.title || 'Store Policy',
      source: metadata.fileName || 'unknown.pdf',
      chunkIndex: chunks.length,
      tokenCount: estimateTokens(chunkContent),
    });
  }

  return chunks;
}

module.exports = { chunkText, estimateTokens };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node tests/chunker.test.js`
Expected: PASS ("Task 3 chunker & pdf-loader test passed")

- [ ] **Step 5: Commit**

```bash
git add src/services/pdf-loader.js src/services/chunker.js tests/chunker.test.js
git commit -m "feat: implement PDF text extraction and token-aware chunker"
```

---

### Task 4: Embedding Service & Pinecone Vector Client

**Files:**
- Create: `src/services/embedding.js`
- Create: `src/services/pinecone.js`
- Test: `tests/services.test.js`

**Interfaces:**
- Consumes: `src/config.js`, `openai`, `@pinecone-database/pinecone`
- Produces:
  - `getEmbedding(text)`: Promise<number[]> (1024 floats)
  - `getEmbeddings(texts)`: Promise<number[][]>
  - `pineconeIndex`: Pinecone Index instance
  - `upsertPolicyChunks(chunksWithVectors)`: Promise<number> (count of records upserted)
  - `querySimilarChunks(queryVector, topK)`: Promise<Array<{ id, score, metadata: { text, title, source, chunkIndex } }>>

- [ ] **Step 1: Write test for embedding and pinecone services**

```javascript
// tests/services.test.js
const assert = require('assert');
const { getEmbedding } = require('../src/services/embedding');
const { querySimilarChunks, getPineconeIndex } = require('../src/services/pinecone');

async function testServices() {
  console.log('Testing local embedding generation...');
  const vector = await getEmbedding('Return and refund policy for damaged goods');
  assert.ok(Array.isArray(vector), 'Embedding should be an array');
  assert.strictEqual(vector.length, 1024, 'Vector dimension must be 1024');

  console.log('Testing Pinecone index connection...');
  const index = getPineconeIndex();
  assert.ok(index, 'Pinecone index object should be created');

  console.log('Testing Pinecone query with vector...');
  const results = await querySimilarChunks(vector, 3);
  assert.ok(Array.isArray(results), 'Query results should be an array');
  console.log(`Pinecone query returned ${results.length} matches`);

  console.log('Task 4 services test passed');
}

testServices().catch(err => {
  console.error('Services test failed:', err);
  process.exit(1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tests/services.test.js`
Expected: FAIL (`Cannot find module '../src/services/embedding'`)

- [ ] **Step 3: Implement embedding and Pinecone services**

Create `src/services/embedding.js`:
```javascript
const OpenAI = require('openai');
const config = require('../config');

const openai = new OpenAI({
  baseURL: config.openaiEndpoint,
  apiKey: config.openaiApiKey,
});

async function getEmbedding(text) {
  const cleanInput = (text || '').replace(/\n+/g, ' ').trim();
  if (!cleanInput) {
    throw new Error('Cannot embed empty text');
  }

  const response = await openai.embeddings.create({
    model: config.embeddingModel,
    input: cleanInput,
  });

  if (!response.data || !response.data[0] || !response.data[0].embedding) {
    throw new Error('Invalid embedding response from local model endpoint');
  }

  return response.data[0].embedding;
}

async function getEmbeddings(texts, batchSize = 5) {
  const results = [];
  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const batchPromises = batch.map(t => getEmbedding(t));
    const batchEmbeddings = await Promise.all(batchPromises);
    results.push(...batchEmbeddings);
  }
  return results;
}

module.exports = { getEmbedding, getEmbeddings, openai };
```

Create `src/services/pinecone.js`:
```javascript
const { Pinecone } = require('@pinecone-database/pinecone');
const config = require('../config');

const pc = new Pinecone({
  apiKey: config.pineconeApiKey,
});

function getPineconeIndex() {
  return pc.index(config.pineconeIndex);
}

async function upsertPolicyChunks(chunksWithVectors) {
  const index = getPineconeIndex();
  const namespace = index.namespace(config.pineconeNamespace);

  const vectors = chunksWithVectors.map(chunk => ({
    id: chunk.id,
    values: chunk.vector,
    metadata: {
      text: chunk.text,
      title: chunk.title,
      source: chunk.source,
      chunkIndex: chunk.chunkIndex,
    },
  }));

  // Upsert in batches of 50
  const batchSize = 50;
  for (let i = 0; i < vectors.length; i += batchSize) {
    const slice = vectors.slice(i, i + batchSize);
    await namespace.upsert(slice);
  }

  return vectors.length;
}

async function querySimilarChunks(queryVector, topK = 5) {
  const index = getPineconeIndex();
  const namespace = index.namespace(config.pineconeNamespace);

  const response = await namespace.query({
    vector: queryVector,
    topK,
    includeMetadata: true,
  });

  return response.matches || [];
}

module.exports = {
  getPineconeIndex,
  upsertPolicyChunks,
  querySimilarChunks,
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node tests/services.test.js`
Expected: PASS ("Task 4 services test passed")

- [ ] **Step 5: Commit**

```bash
git add src/services/embedding.js src/services/pinecone.js tests/services.test.js
git commit -m "feat: implement local embedding and pinecone vector operations"
```

---

### Task 5: Ingestion Pipeline Script

**Files:**
- Create: `scripts/ingest.js`
- Test: `tests/ingest.test.js`

**Interfaces:**
- Consumes: `policies/*.pdf`, `pdf-loader.js`, `chunker.js`, `embedding.js`, `pinecone.js`
- Produces: Upserted policy vectors in Pinecone namespace `policy`

- [ ] **Step 1: Write test for ingestion outcome**

```javascript
// tests/ingest.test.js
const assert = require('assert');
const { getPineconeIndex, querySimilarChunks } = require('../src/services/pinecone');
const { getEmbedding } = require('../src/services/embedding');

async function testIngestionResult() {
  const index = getPineconeIndex();
  const stats = await index.describeIndexStats();
  console.log('Pinecone index stats:', stats);

  // Query for a specific policy concept to test retrieval
  const queryVector = await getEmbedding('return window 30 days refund');
  const matches = await querySimilarChunks(queryVector, 3);
  
  assert.ok(matches.length > 0, 'Should find matches in Pinecone after ingestion');
  assert.ok(matches[0].score > 0.4, 'Top match should have strong cosine similarity');
  assert.ok(matches[0].metadata.text.toLowerCase().includes('return') || matches[0].metadata.text.toLowerCase().includes('refund'), 'Match text should be relevant');

  console.log('Task 5 ingestion verification passed');
}

testIngestionResult().catch(err => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 2: Run test to verify current state**

Run: `node tests/ingest.test.js`
Expected: May return 0 matches or fail if vectors aren't ingested yet.

- [ ] **Step 3: Implement ingest.js**

Create `scripts/ingest.js`:
```javascript
const path = require('path');
const config = require('../src/config');
const { loadAllPolicies } = require('../src/services/pdf-loader');
const { chunkText } = require('../src/services/chunker');
const { getEmbedding } = require('../src/services/embedding');
const { upsertPolicyChunks } = require('../src/services/pinecone');

async function main() {
  console.log('=== Starting E-Commerce Policies Ingestion Pipeline ===');
  console.log(`Target Index: ${config.pineconeIndex}`);
  console.log(`Namespace: ${config.pineconeNamespace}`);
  console.log(`Embedding Model: ${config.embeddingModel} via ${config.openaiEndpoint}`);

  const policiesDir = path.join(__dirname, '../policies');
  const documents = await loadAllPolicies(policiesDir);
  console.log(`Loaded ${documents.length} PDF documents from policies/`);

  let allChunks = [];
  for (const doc of documents) {
    const chunks = chunkText(doc.text, {
      fileName: doc.fileName,
      title: doc.title,
    }, { targetChunkTokens: 300, overlapTokens: 30 });

    console.log(`- ${doc.fileName}: ${chunks.length} chunks generated`);
    allChunks.push(...chunks);
  }

  console.log(`Total chunks across all policies: ${allChunks.length}`);
  console.log('Generating vector embeddings using local model...');

  const chunksWithVectors = [];
  for (let i = 0; i < allChunks.length; i++) {
    const chunk = allChunks[i];
    process.stdout.write(`\rEmbedding chunk [${i + 1}/${allChunks.length}]: ${chunk.id}`);
    const vector = await getEmbedding(chunk.text);
    chunksWithVectors.push({
      ...chunk,
      vector,
    });
  }
  console.log('\nEmbedding generation completed.');

  console.log('Upserting vectors into Pinecone...');
  const upsertedCount = await upsertPolicyChunks(chunksWithVectors);
  console.log(`Successfully upserted ${upsertedCount} vectors into Pinecone namespace "${config.pineconeNamespace}".`);
  console.log('=== Ingestion Complete ===');
}

if (require.main === module) {
  main().catch(err => {
    console.error('Ingestion failed:', err);
    process.exit(1);
  });
}

module.exports = { main };
```

Execute ingestion:
```bash
npm run ingest
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node tests/ingest.test.js`
Expected: PASS ("Task 5 ingestion verification passed")

- [ ] **Step 5: Commit**

```bash
git add scripts/ingest.js tests/ingest.test.js
git commit -m "feat: add document ingestion pipeline and vector upsert"
```

---

### Task 6: Express Server & Query Endpoint with MIKU Persona

**Files:**
- Create: `src/server.js`
- Test: `tests/query.test.js`

**Interfaces:**
- Consumes: `src/config.js`, `src/services/embedding.js`, `src/services/pinecone.js`
- Produces:
  - `POST /api/query`: `{ question: string }` -> `{ agent: "MIKU", answer: string, sources: Array<{ title, fileName, score, text }> }`
  - `GET /api/health`: `{ status: "ok", pineconeIndex, model, embeddingModel }`
  - Static files served from `public/`

- [ ] **Step 1: Write integration tests for query endpoint & guardrails**

```javascript
// tests/query.test.js
const assert = require('assert');
const http = require('http');

function postJson(url, data) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(data);
    const u = new URL(url);
    const req = http.request({
      hostname: u.hostname,
      port: u.port,
      path: u.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    }, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve({ status: res.statusCode, data: JSON.parse(body) }));
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function run() {
  console.log('Testing in-scope question (Returns)...');
  const res1 = await postJson('http://localhost:3000/api/query', {
    question: 'How many days do I have to return an item?'
  });
  assert.strictEqual(res1.status, 200);
  assert.strictEqual(res1.data.agent, 'MIKU');
  assert.ok(res1.data.answer.includes('30'), 'Answer should mention 30 days');
  assert.ok(res1.data.sources.length > 0, 'Sources should be returned');

  console.log('Testing out-of-scope question (Recipe rejection)...');
  const res2 = await postJson('http://localhost:3000/api/query', {
    question: 'How do I bake a chocolate cake at home?'
  });
  assert.strictEqual(res2.status, 200);
  assert.ok(
    res2.data.answer.toLowerCase().includes("don't have the information") ||
    res2.data.answer.toLowerCase().includes("store policies"),
    'Should politely reject out-of-scope question'
  );

  console.log('Testing 400 empty question...');
  const res3 = await postJson('http://localhost:3000/api/query', { question: '   ' });
  assert.strictEqual(res3.status, 400);

  console.log('Task 6 query integration tests passed');
}

run().catch(err => {
  console.error('Query test failed:', err);
  process.exit(1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tests/query.test.js`
Expected: FAIL (connection refused on port 3000)

- [ ] **Step 3: Implement Express server and RAG query pipeline**

Create `src/server.js`:
```javascript
const express = require('express');
const cors = require('cors');
const path = require('path');
const config = require('./config');
const { getEmbedding, openai } = require('./services/embedding');
const { querySimilarChunks, getPineconeIndex } = require('./services/pinecone');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

const MIKU_SYSTEM_PROMPT = `You are MIKU, a soft, friendly, and polite female customer support assistant for our e-commerce store.
Always address the customer kindly, gently, and in a warm, welcoming tone.

CRITICAL POLICY GUARDRAILS:
1. Answer the customer's question using ONLY the provided Policy Context below.
2. If the user's question cannot be answered using the context, or if they ask about topics unrelated to our store policies (such as recipes, coding, world trivia, math, general chat), you MUST politely reply:
   "I'm sorry, but I don't have the information you are asking for. Please feel free to check our official store policies or reach out to our customer support team!"
3. Do NOT make up policies, dates, fees, or rules not explicitly mentioned in the context.
4. Keep your answer concise, soft-spoken, and helpful.`;

app.get('/api/health', async (req, res) => {
  try {
    const index = getPineconeIndex();
    const stats = await index.describeIndexStats();
    res.json({
      status: 'ok',
      agent: 'MIKU',
      model: config.model,
      embeddingModel: config.embeddingModel,
      pineconeIndex: config.pineconeIndex,
      namespace: config.pineconeNamespace,
      stats,
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

app.post('/api/query', async (req, res) => {
  const { question } = req.body;
  if (!question || typeof question !== 'string' || !question.trim()) {
    return res.status(400).json({ error: 'Question is required and must be non-empty.' });
  }

  try {
    // 1. Generate query embedding
    const queryVector = await getEmbedding(question);

    // 2. Query Pinecone for top 5-6 chunks using cosine similarity
    const matches = await querySimilarChunks(queryVector, 5);

    // 3. Format context blocks
    const contextBlocks = matches.map((m, idx) => {
      return `[Policy Document ${idx + 1}: ${m.metadata.title} (${m.metadata.source}) | Score: ${m.score?.toFixed(3)}]\n${m.metadata.text}`;
    }).join('\n\n');

    // 4. Construct prompt for local LLM
    const systemPromptWithContext = `${MIKU_SYSTEM_PROMPT}\n\nPolicy Context:\n---\n${contextBlocks}\n---`;

    const completion = await openai.chat.completions.create({
      model: config.model,
      messages: [
        { role: 'system', content: systemPromptWithContext },
        { role: 'user', content: question.trim() },
      ],
      temperature: 0.2,
      max_tokens: 350,
    });

    const answer = completion.choices[0]?.message?.content?.trim() || "I'm sorry, I could not generate an answer.";

    const sources = matches.map(m => ({
      id: m.id,
      title: m.metadata.title,
      fileName: m.metadata.source,
      score: m.score ? parseFloat(m.score.toFixed(4)) : null,
      text: m.metadata.text,
    }));

    res.json({
      agent: 'MIKU',
      answer,
      sources,
    });
  } catch (err) {
    console.error('Query processing error:', err);
    res.status(500).json({
      error: 'Failed to process query',
      details: err.message,
    });
  }
});

if (require.main === module) {
  app.listen(config.port, () => {
    console.log(`🌸 MIKU E-Commerce RAG Assistant Server running on http://localhost:${config.port}`);
  });
}

module.exports = app;
```

- [ ] **Step 4: Run test to verify it passes**

Run server in background and run `node tests/query.test.js`
Expected: PASS ("Task 6 query integration tests passed")

- [ ] **Step 5: Commit**

```bash
git add src/server.js tests/query.test.js
git commit -m "feat: implement Express server and MIKU RAG query pipeline"
```

---

### Task 7: Frontend Web Interface (`public/`)

**Files:**
- Create: `public/index.html`
- Create: `public/style.css`
- Create: `public/app.js`
- Test: `tests/ui.test.js`

**Interfaces:**
- Consumes: `POST /api/query`, `GET /api/health`
- Produces: Interactive web UI with MIKU avatar, chat log, prompt suggestion chips, and vector context inspection drawer.

- [ ] **Step 1: Write UI asset and serving verification test**

```javascript
// tests/ui.test.js
const fs = require('fs');
const path = require('path');
const assert = require('assert');

function testUIFiles() {
  const publicDir = path.join(__dirname, '../public');
  assert.ok(fs.existsSync(path.join(publicDir, 'index.html')), 'index.html should exist');
  assert.ok(fs.existsSync(path.join(publicDir, 'style.css')), 'style.css should exist');
  assert.ok(fs.existsSync(path.join(publicDir, 'app.js')), 'app.js should exist');

  const html = fs.readFileSync(path.join(publicDir, 'index.html'), 'utf8');
  assert.ok(html.includes('MIKU'), 'HTML should feature MIKU');
  assert.ok(html.includes('id="chat-box"'), 'HTML should have chat-box container');
  console.log('Task 7 UI files verified');
}

testUIFiles();
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tests/ui.test.js`
Expected: FAIL (`index.html should exist`)

- [ ] **Step 3: Implement Frontend HTML, CSS, and JS**

Create `public/index.html`:
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MIKU - E-Commerce Policy Support</title>
  <link rel="stylesheet" href="style.css">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
</head>
<body>
  <div class="app-container">
    <header class="chat-header">
      <div class="agent-profile">
        <div class="avatar-ring">
          <div class="avatar">🌸</div>
        </div>
        <div class="agent-info">
          <h2>MIKU <span class="badge">Customer Support</span></h2>
          <p class="status"><span class="dot"></span> Online • Powered by Local RAG & Pinecone</p>
        </div>
      </div>
      <div class="system-stats" id="system-stats">Connecting...</div>
    </header>

    <main class="chat-main" id="chat-box">
      <div class="message assistant-message">
        <div class="bubble">
          Hello! I'm <strong>MIKU</strong>, your customer support assistant 🌸 How may I help you today? You can ask me anything about our shipping, returns, warranty, cancellations, or store policies!
        </div>
      </div>
    </main>

    <div class="suggestions-container">
      <button class="chip" data-query="How many days do I have to return an item?">📦 Return Window</button>
      <button class="chip" data-query="Do you offer free shipping?">🚚 Free Shipping</button>
      <button class="chip" data-query="Can I cancel my order after 1 hour?">⏱️ Cancel Order</button>
      <button class="chip" data-query="What does the 1-year warranty cover?">🛡️ Warranty Coverage</button>
      <button class="chip" data-query="What is the recipe for chocolate cake?">🍰 Out-of-Scope Test</button>
    </div>

    <footer class="chat-input-area">
      <form id="chat-form">
        <input 
          type="text" 
          id="query-input" 
          placeholder="Ask MIKU a question about store policies..." 
          autocomplete="off" 
          required 
        />
        <button type="submit" id="send-btn">
          <span>Send</span>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="22" y1="2" x2="11" y2="13"></line>
            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
          </svg>
        </button>
      </form>
    </footer>
  </div>

  <script src="app.js"></script>
</body>
</html>
```

Create `public/style.css`:
```css
:root {
  --primary: #f472b6;
  --primary-hover: #ec4899;
  --primary-soft: #fdf2f8;
  --bg-gradient: linear-gradient(135deg, #fdf4f5 0%, #f7fee7 50%, #eff6ff 100%);
  --panel-bg: #ffffff;
  --text-main: #1f2937;
  --text-muted: #6b7280;
  --border-color: #f3e8ff;
  --shadow: 0 10px 30px -5px rgba(244, 114, 182, 0.15);
}

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: 'Plus Jakarta Sans', sans-serif;
  background: var(--bg-gradient);
  color: var(--text-main);
  min-height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 20px;
}

.app-container {
  width: 100%;
  max-width: 850px;
  height: 90vh;
  background: var(--panel-bg);
  border-radius: 24px;
  box-shadow: var(--shadow);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid rgba(244, 114, 182, 0.2);
}

.chat-header {
  padding: 18px 24px;
  background: #fff;
  border-bottom: 1px solid #f1f5f9;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.agent-profile {
  display: flex;
  align-items: center;
  gap: 14px;
}

.avatar-ring {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: linear-gradient(135deg, #f472b6, #c084fc);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2px;
}

.avatar {
  width: 100%;
  height: 100%;
  background: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
}

.agent-info h2 {
  font-size: 1.15rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 8px;
}

.badge {
  font-size: 0.72rem;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 12px;
  background: var(--primary-soft);
  color: #db2777;
}

.status {
  font-size: 0.8rem;
  color: var(--text-muted);
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 2px;
}

.dot {
  width: 8px;
  height: 8px;
  background: #10b981;
  border-radius: 50%;
  display: inline-block;
}

.system-stats {
  font-size: 0.78rem;
  color: #9ca3af;
  background: #f8fafc;
  padding: 6px 12px;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
}

.chat-main {
  flex: 1;
  padding: 24px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 18px;
  background: #fafafa;
}

.message {
  display: flex;
  flex-direction: column;
  max-width: 80%;
  animation: fadeIn 0.3s ease-in-out;
}

.user-message {
  align-self: flex-end;
}

.assistant-message {
  align-self: flex-start;
}

.bubble {
  padding: 14px 18px;
  border-radius: 18px;
  font-size: 0.95rem;
  line-height: 1.55;
}

.user-message .bubble {
  background: linear-gradient(135deg, #ec4899, #d946ef);
  color: white;
  border-bottom-right-radius: 4px;
}

.assistant-message .bubble {
  background: white;
  color: var(--text-main);
  border: 1px solid #f1f5f9;
  border-bottom-left-radius: 4px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

.rag-drawer {
  margin-top: 8px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 10px 14px;
  font-size: 0.82rem;
}

.rag-drawer summary {
  cursor: pointer;
  font-weight: 600;
  color: #475569;
  display: flex;
  align-items: center;
  gap: 6px;
}

.rag-sources {
  margin-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.source-item {
  background: white;
  padding: 8px 10px;
  border-radius: 6px;
  border: 1px solid #e2e8f0;
}

.source-header {
  display: flex;
  justify-content: space-between;
  font-weight: 600;
  color: #0284c7;
  margin-bottom: 4px;
}

.source-score {
  font-size: 0.72rem;
  background: #e0f2fe;
  color: #0369a1;
  padding: 1px 6px;
  border-radius: 4px;
}

.source-snippet {
  color: #64748b;
  font-size: 0.78rem;
  line-height: 1.4;
}

.suggestions-container {
  padding: 8px 24px;
  display: flex;
  gap: 8px;
  overflow-x: auto;
  background: white;
  border-top: 1px solid #f1f5f9;
}

.chip {
  background: #fdf2f8;
  border: 1px solid #fbcfe8;
  color: #be185d;
  padding: 6px 12px;
  border-radius: 16px;
  font-size: 0.8rem;
  font-weight: 500;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.2s;
}

.chip:hover {
  background: #fce7f3;
  transform: translateY(-1px);
}

.chat-input-area {
  padding: 16px 24px;
  background: white;
  border-top: 1px solid #f1f5f9;
}

#chat-form {
  display: flex;
  gap: 12px;
}

#query-input {
  flex: 1;
  padding: 12px 18px;
  border-radius: 14px;
  border: 1.5px solid #e2e8f0;
  font-size: 0.95rem;
  outline: none;
  transition: border-color 0.2s;
}

#query-input:focus {
  border-color: var(--primary);
}

#send-btn {
  background: linear-gradient(135deg, #f472b6, #ec4899);
  color: white;
  border: none;
  border-radius: 14px;
  padding: 0 20px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: opacity 0.2s;
}

#send-btn:hover {
  opacity: 0.92;
}

#send-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: translateY(0); }
}
```

Create `public/app.js`:
```javascript
const chatBox = document.getElementById('chat-box');
const chatForm = document.getElementById('chat-form');
const queryInput = document.getElementById('query-input');
const sendBtn = document.getElementById('send-btn');
const systemStats = document.getElementById('system-stats');

async function loadHealth() {
  try {
    const res = await fetch('/api/health');
    const data = await res.json();
    if (data.status === 'ok') {
      systemStats.textContent = `⚡ Pinecone: ${data.pineconeIndex} (${data.namespace}) | Model: ${data.model}`;
    }
  } catch (err) {
    systemStats.textContent = '⚠️ API Offline';
  }
}
loadHealth();

document.querySelectorAll('.chip').forEach(chip => {
  chip.addEventListener('click', () => {
    queryInput.value = chip.dataset.query;
    chatForm.dispatchEvent(new Event('submit'));
  });
});

chatForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const query = queryInput.value.trim();
  if (!query) return;

  appendMessage('user', query);
  queryInput.value = '';
  sendBtn.disabled = true;

  const typingId = appendTypingIndicator();

  try {
    const res = await fetch('/api/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: query }),
    });

    const data = await res.json();
    removeTypingIndicator(typingId);

    if (res.ok) {
      appendMessage('assistant', data.answer, data.sources);
    } else {
      appendMessage('assistant', `⚠️ Error: ${data.error || data.details || 'Failed to get response.'}`);
    }
  } catch (err) {
    removeTypingIndicator(typingId);
    appendMessage('assistant', '⚠️ Error contacting the server. Ensure the server and LM Studio are running.');
  } finally {
    sendBtn.disabled = false;
    queryInput.focus();
  }
});

function appendMessage(role, text, sources = []) {
  const msgDiv = document.createElement('div');
  msgDiv.className = `message ${role}-message`;

  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  bubble.textContent = text;
  msgDiv.appendChild(bubble);

  if (sources && sources.length > 0) {
    const drawer = document.createElement('details');
    drawer.className = 'rag-drawer';
    drawer.innerHTML = `
      <summary>🔍 Retrieved Context (${sources.length} Policy Chunks)</summary>
      <div class="rag-sources">
        ${sources.map(s => `
          <div class="source-item">
            <div class="source-header">
              <span>${s.title}</span>
              <span class="source-score">Cosine Score: ${s.score}</span>
            </div>
            <div class="source-snippet">${escapeHtml(s.text.slice(0, 200))}...</div>
          </div>
        `).join('')}
      </div>
    `;
    msgDiv.appendChild(drawer);
  }

  chatBox.appendChild(msgDiv);
  chatBox.scrollTop = chatBox.scrollHeight;
}

function appendTypingIndicator() {
  const id = 'typing-' + Date.now();
  const div = document.createElement('div');
  div.id = id;
  div.className = 'message assistant-message';
  div.innerHTML = `<div class="bubble" style="font-style: italic; color: #9ca3af;">MIKU is thinking and searching store policies... 🌸</div>`;
  chatBox.appendChild(div);
  chatBox.scrollTop = chatBox.scrollHeight;
  return id;
}

function removeTypingIndicator(id) {
  const el = document.getElementById(id);
  if (el) el.remove();
}

function escapeHtml(str) {
  return str.replace(/[&<>'"]/g, tag => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  }[tag] || tag));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node tests/ui.test.js`
Expected: PASS ("Task 7 UI files verified")

- [ ] **Step 5: Commit**

```bash
git add public/index.html public/style.css public/app.js tests/ui.test.js
git commit -m "feat: implement frontend UI with MIKU persona and RAG inspector"
```
