require('dotenv').config();

const config = {
  port: parseInt(process.env.PORT, 10) || 3000,
  pineconeApiKey: process.env.PINECONE_API_KEY || '',
  pineconeIndex: process.env.PINECONE_INDEX || process.env.PINDECONE_INDEX || 'ragtest',
  pineconeNamespace: process.env.PINECONE_NAMESPACE || 'policy',
  openaiEndpoint: process.env.OPENAI_ENDPOINT || 'http://localhost:1234/v1',
  openaiApiKey: process.env.OPENAI_API_KEY || 'lmstudio',
  model: process.env.MODEL || 'liquid/lfm2-1.2b',
  embeddingModel: process.env.EMBEDDING_MODEL || 'text-embedding-baai-bge-m3-568m',
  dimension: parseInt(process.env.DIMENSION, 10) || 1024,
};

if (!config.pineconeApiKey) {
  throw new Error('PINECONE_API_KEY is required in environment variables');
}

module.exports = config;
