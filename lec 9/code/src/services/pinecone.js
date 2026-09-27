import { Pinecone } from '@pinecone-database/pinecone';
import config from '../config.js';

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

async function clearPolicyNamespace() {
  const index = getPineconeIndex();
  const namespace = index.namespace(config.pineconeNamespace);
  await namespace.deleteAll();
}

export {
  getPineconeIndex,
  upsertPolicyChunks,
  querySimilarChunks,
  clearPolicyNamespace,
};

