const fs = require('fs');
const path = require('path');
const { PDFParse } = require('pdf-parse');
const mammoth = require('mammoth');

const extractorService = {
  async extractText(filePath, fileType) {
    const ext = (fileType || path.extname(filePath)).toLowerCase();

    if (ext.includes('pdf')) {
      return await this.extractPdf(filePath);
    } else if (ext.includes('doc')) {
      return await this.extractDocx(filePath);
    } else {
      throw new Error(`Unsupported file format: ${ext}`);
    }
  },

  async extractPdf(filePath) {
    try {
      const dataBuffer = fs.readFileSync(filePath);
      const parser = new PDFParse({ data: dataBuffer });
      const parsed = await parser.getText();

      const totalPages = parsed.total || 1;
      const pages = (parsed.pages || []).map(p => ({
        page: p.num || 1,
        text: p.text || ''
      }));

      const fullText = parsed.text || pages.map(p => p.text).join('\n\n');

      return {
        success: true,
        total_pages: totalPages,
        pages: pages.length > 0 ? pages : [{ page: 1, text: fullText }],
        full_text: fullText
      };
    } catch (err) {
      console.error('PDF native extraction error:', err.message);
      throw new Error(`Failed to extract text from PDF: ${err.message}`);
    }
  },

  async extractDocx(filePath) {
    try {
      const result = await mammoth.extractRawText({ path: filePath });
      const fullText = result.value || '';
      
      // Split text into virtual pages (every ~5 paragraphs or ~1500 chars) for page-level citation
      const paragraphs = fullText.split(/\n\s*\n/).filter(p => p.trim());
      const pages = [];
      const paragraphsPerPage = 5;
      
      for (let i = 0; i < paragraphs.length; i += paragraphsPerPage) {
        const chunk = paragraphs.slice(i, i + paragraphsPerPage).join('\n\n');
        pages.push({
          page: Math.floor(i / paragraphsPerPage) + 1,
          text: chunk
        });
      }

      if (pages.length === 0) {
        pages.push({ page: 1, text: fullText });
      }

      return {
        success: true,
        total_pages: pages.length,
        pages: pages,
        full_text: fullText
      };
    } catch (err) {
      console.error('DOCX native extraction error:', err.message);
      throw new Error(`Failed to extract text from DOCX: ${err.message}`);
    }
  }
};

module.exports = extractorService;
