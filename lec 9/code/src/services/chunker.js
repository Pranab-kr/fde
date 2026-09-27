/**
 * Approximates token count based on whitespace and words (approx 0.75 words per token or ~4 chars/token).
 * @param {string} text
 * @returns {number}
 */
function estimateTokens(text) {
  if (!text || typeof text !== 'string') return 0;
  const words = text.trim().split(/\s+/).filter(Boolean);
  return Math.ceil(words.length * 1.3);
}

/**
 * Splits text into ~300 token chunks with configurable overlap.
 * Uses sentence/paragraph boundaries where possible to avoid cutting mid-sentence.
 * @param {string} text
 * @param {object} [metadata={}]
 * @param {object} [options={}]
 * @returns {Array<{ id: string, text: string, title: string, source: string, chunkIndex: number, tokenCount: number }>}
 */
function chunkText(text, metadata = {}, options = {}) {
  if (!text || typeof text !== 'string') return [];

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

export { chunkText, estimateTokens };
