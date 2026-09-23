const embeddingService = require('./embeddingService');

module.exports = {
  VECTOR_DIM: embeddingService.VECTOR_DIM,
  tokenize: (text) => embeddingService.tokenize(text),
  generateEmbeddings: (textArray) => embeddingService.generateEmbeddings(textArray),
  generateEmbedding: (text) => embeddingService.generateEmbedding(text)
};
