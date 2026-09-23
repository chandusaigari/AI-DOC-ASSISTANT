const faissService = require('./faissService');

module.exports = {
  VECTOR_DIM: faissService.VECTOR_DIM,
  buildIndex: (userId, vectors) => faissService.buildIndex(userId, vectors),
  rebuildIndex: (userId, chunkTexts) => faissService.rebuildIndex(userId, chunkTexts),
  searchIndex: (userId, queryVector, topK) => faissService.searchIndex(userId, queryVector, topK),
  getIndexMetadata: (userId) => faissService.getIndexMetadata(userId),
  getUserIndexFilePath: (userId) => faissService.getUserIndexFilePath(userId)
};
