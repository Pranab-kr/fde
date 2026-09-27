import assert from 'assert';
import { getEmbedding, getEmbeddings } from '../src/services/embedding.js';
import { querySimilarChunks, getPineconeIndex, upsertPolicyChunks } from '../src/services/pinecone.js';


async function testServices() {
  console.log('Testing local embedding generation...');
  const vector = await getEmbedding('Return and refund policy for damaged goods');
  assert.ok(Array.isArray(vector), 'Embedding should be an array');
  assert.strictEqual(vector.length, 1024, 'Vector dimension must be 1024');

  console.log('Testing batch embeddings generation...');
  const batchVectors = await getEmbeddings(['Chunk 1', 'Chunk 2']);
  assert.strictEqual(batchVectors.length, 2, 'Batch embeddings should return 2 vectors');
  assert.strictEqual(batchVectors[0].length, 1024, 'Vector 1 dimension must be 1024');
  assert.strictEqual(batchVectors[1].length, 1024, 'Vector 2 dimension must be 1024');

  console.log('Testing empty text validation...');
  await assert.rejects(
    async () => await getEmbedding('   '),
    /Cannot embed empty text/,
    'Should reject empty or whitespace-only text'
  );

  console.log('Testing Pinecone index connection...');
  const index = getPineconeIndex();
  assert.ok(index, 'Pinecone index object should be created');

  assert.strictEqual(typeof upsertPolicyChunks, 'function', 'upsertPolicyChunks should be a function');

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
