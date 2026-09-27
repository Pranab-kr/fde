const assert = require('assert');

function run() {
  const config = require('../src/config');
  assert.strictEqual(typeof config.port, 'number');
  assert.strictEqual(typeof config.pineconeApiKey, 'string');
  assert.ok(config.pineconeApiKey.length > 0, 'PINECONE_API_KEY should not be empty');
  assert.strictEqual(config.pineconeIndex, 'ragtest');
  assert.strictEqual(config.pineconeNamespace, 'policy');
  assert.strictEqual(config.dimension, 1024);
  assert.strictEqual(config.embeddingModel, 'text-embedding-baai-bge-m3-568m');
  assert.strictEqual(config.model, 'liquid/lfm2-1.2b');
  assert.strictEqual(config.openaiEndpoint, 'http://localhost:1234/v1');
  assert.strictEqual(config.openaiApiKey, 'lmstudio');
  console.log('Task 1 config test passed');
}

run();
