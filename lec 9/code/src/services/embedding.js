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
