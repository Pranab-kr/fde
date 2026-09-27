import path from 'path';
import process from 'process';
import { fileURLToPath } from 'url';
import config from '../src/config.js';
import { loadAllPolicies } from '../src/services/pdf-loader.js';
import { chunkText } from '../src/services/chunker.js';
import { getEmbedding } from '../src/services/embedding.js';
import { upsertPolicyChunks, clearPolicyNamespace } from '../src/services/pinecone.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


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
    }, { targetChunkTokens: 150, overlapTokens: 25 });

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

  console.log(`Clearing existing vectors in Pinecone namespace "${config.pineconeNamespace}"...`);
  await clearPolicyNamespace();

  console.log('Upserting vectors into Pinecone...');
  const upsertedCount = await upsertPolicyChunks(chunksWithVectors);
  console.log(`Successfully upserted ${upsertedCount} vectors into Pinecone namespace "${config.pineconeNamespace}".`);
  console.log('=== Ingestion Complete ===');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch(err => {
    console.error('Ingestion failed:', err);
    process.exit(1);
  });
}

export { main };

