const assert = require('assert');
const path = require('path');
const { chunkText, estimateTokens } = require('../src/services/chunker');
const { loadPdf, loadAllPolicies } = require('../src/services/pdf-loader');

async function testChunker() {
  // Test estimateTokens
  assert.strictEqual(estimateTokens(''), 0, 'estimateTokens on empty string should be 0');
  assert.strictEqual(estimateTokens(null), 0, 'estimateTokens on null should be 0');
  assert.strictEqual(estimateTokens(undefined), 0, 'estimateTokens on undefined should be 0');
  assert.ok(estimateTokens('Hello world this is a test') > 0, 'estimateTokens should return > 0 for words');

  // Test chunkText with long text
  const sampleText = `Section 1. Return Window. Customers have 30 days to return. `.repeat(40);
  const metadata = { fileName: 'return_refund_policy.pdf', title: 'Return Policy' };
  
  const chunks = chunkText(sampleText, metadata, { targetChunkTokens: 100, overlapTokens: 20 });
  assert.ok(chunks.length > 1, 'Should split long text into multiple chunks');
  assert.strictEqual(chunks[0].source, 'return_refund_policy.pdf');
  assert.strictEqual(chunks[0].title, 'Return Policy');
  assert.strictEqual(chunks[0].chunkIndex, 0);
  assert.ok(chunks[0].id.includes('return_refund_policy.pdf-chunk-0'), 'Chunk id should contain fileName and index');
  assert.ok(chunks[0].tokenCount > 0, 'Chunk tokenCount should be positive');

  // Verify overlap: last sentence of chunk 0 should be present in chunk 1
  assert.ok(chunks[1].chunkIndex === 1, 'Second chunk should have chunkIndex 1');
  assert.ok(chunks[1].id.includes('return_refund_policy.pdf-chunk-1'));
  const chunk0Sentences = chunks[0].text.split(/(?<=[.!?\n])\s+/);
  const chunk0TailSentence = chunk0Sentences[chunk0Sentences.length - 1];
  assert.ok(chunks[1].text.includes(chunk0TailSentence), 'Chunk 1 should contain the overlapping tail sentence from chunk 0');

  // Verify overlap with distinct sentences
  const distinctText = 'Sentence alpha. Sentence beta. Sentence gamma. Sentence delta. Sentence epsilon.';
  const distinctChunks = chunkText(distinctText, { fileName: 'distinct.pdf' }, { targetChunkTokens: 8, overlapTokens: 4 });
  assert.ok(distinctChunks.length > 1, 'Distinct text should split into multiple chunks');
  const distinctTail = distinctChunks[0].text.split(/(?<=[.!?\n])\s+/).pop();
  assert.ok(distinctChunks[1].text.includes(distinctTail), 'Chunk 1 must contain tail sentence of Chunk 0');
  assert.ok(distinctChunks[1].text.startsWith(distinctTail), 'Chunk 1 must start with overlapping sentence from Chunk 0');

  // Test chunkText fallback defaults and edge cases
  assert.deepStrictEqual(chunkText(''), [], 'Empty string should yield empty array');
  assert.deepStrictEqual(chunkText(null), [], 'Null should yield empty array');
  assert.deepStrictEqual(chunkText(undefined), [], 'Undefined should yield empty array');

  // Single long sentence exceeding target tokens
  const longSentence = 'Word '.repeat(200) + '.';
  const singleLongChunks = chunkText(longSentence, {}, { targetChunkTokens: 50 });
  assert.strictEqual(singleLongChunks.length, 1, 'Single long sentence should form one chunk');
  assert.ok(singleLongChunks[0].tokenCount > 50, 'Chunk token count reflects long sentence');

  // Multiline text splitting
  const multilineText = 'Paragraph 1 line 1.\nParagraph 2 line 2.\nParagraph 3 line 3.';
  const multilineChunks = chunkText(multilineText, { fileName: 'multiline.pdf' }, { targetChunkTokens: 10, overlapTokens: 2 });
  assert.ok(multilineChunks.length > 1, 'Multiline text splits into chunks');

  const singleChunk = chunkText('Short policy statement.');
  assert.strictEqual(singleChunk.length, 1);
  assert.strictEqual(singleChunk[0].title, 'Store Policy');
  assert.strictEqual(singleChunk[0].source, 'unknown.pdf');
  assert.strictEqual(singleChunk[0].chunkIndex, 0);

  // Test loading actual generated PDF
  const pdfPath = path.join(__dirname, '../policies/return_refund_policy.pdf');
  const loaded = await loadPdf(pdfPath);
  assert.ok(loaded.text.length > 100, 'Loaded PDF should contain extracted text');
  assert.ok(loaded.text.includes('30 calendar days'), 'Extracted text should contain policy content');
  assert.ok(loaded.numPages >= 1, 'Loaded PDF should have at least 1 page');
  assert.ok(typeof loaded.info === 'object', 'Loaded PDF should contain info object');

  // Test loading all policies from directory
  const policiesDir = path.join(__dirname, '../policies');
  const allPolicies = await loadAllPolicies(policiesDir);
  assert.ok(Array.isArray(allPolicies), 'loadAllPolicies should return an array');
  assert.strictEqual(allPolicies.length, 6, 'Should load all 6 policy PDFs');
  const fileNames = allPolicies.map(p => p.fileName);
  assert.deepStrictEqual(fileNames, [...fileNames].sort(), 'loadAllPolicies should return files in deterministic sorted order');
  const returnRefundPolicy = allPolicies.find(p => p.fileName === 'return_refund_policy.pdf');
  assert.ok(returnRefundPolicy, 'Should find return_refund_policy.pdf in all policies');
  assert.strictEqual(returnRefundPolicy.title, 'Return Refund Policy');
  assert.ok(returnRefundPolicy.text.includes('30 calendar days'));

  // Test loadAllPolicies on directory without pdfs
  const emptyDir = path.join(__dirname, '../src');
  const noPdfs = await loadAllPolicies(emptyDir);
  assert.deepStrictEqual(noPdfs, [], 'Directory with no PDFs should return empty array');

  console.log('Task 3 chunker & pdf-loader test passed');
}

testChunker().catch(err => {
  console.error(err);
  process.exit(1);
});
