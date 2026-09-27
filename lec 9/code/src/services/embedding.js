import OpenAI from 'openai';
import config from '../config.js';

const openai = new OpenAI({
  baseURL: config.openaiEndpoint,
  apiKey: config.openaiApiKey,
});

async function getEmbedding(text) {
  const cleanInput = (text || '').replace(/\n+/g, ' ').trim();
  if (!cleanInput) {
    throw new Error('Cannot embed empty text');
  }

  let response;
  const requestPayload = {
    model: config.embeddingModel,
    input: cleanInput,
  };

  if (config.dimension) {
    requestPayload.dimensions = config.dimension;
  }

  try {
    response = await openai.embeddings.create(requestPayload);
  } catch (err) {
    // If provider/model does not support the 'dimensions' parameter, retry without it
    const msg = (err.message || '').toLowerCase();
    if (requestPayload.dimensions && (msg.includes('dimensions') || msg.includes('extra') || err.status === 400)) {
      delete requestPayload.dimensions;
      response = await openai.embeddings.create(requestPayload);
    } else {
      throw err;
    }
  }

  if (!response.data || !response.data[0] || !response.data[0].embedding) {
    throw new Error('Invalid embedding response from model endpoint');
  }

  const embedding = response.data[0].embedding;

  // Pre-flight check: ensure vector dimensions match Pinecone index requirements
  if (config.dimension && embedding.length !== config.dimension) {
    throw new Error(
      `Dimension mismatch: Model '${config.embeddingModel}' produced a ${embedding.length}-dimensional vector, ` +
      `but Pinecone index '${config.pineconeIndex}' requires ${config.dimension} dimensions. ` +
      `Please create a ${embedding.length}-dim index or set DIMENSION in .env.`
    );
  }

  return embedding;
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

export { getEmbedding, getEmbeddings, openai };

