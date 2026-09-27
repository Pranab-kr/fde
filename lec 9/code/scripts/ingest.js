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
