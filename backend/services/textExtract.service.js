const extractorService = require('./extractorService');

module.exports = {
  extractText: (filePath, fileType) => extractorService.extractText(filePath, fileType),
  extractPdf: (filePath) => extractorService.extractPdf(filePath),
  extractDocx: (filePath) => extractorService.extractDocx(filePath)
};
