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
