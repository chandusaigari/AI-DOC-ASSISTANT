const chunkerService = {
  createChunks(extractionData, targetChunkSize = 800) {
    const chunks = [];
    let globalChunkIndex = 0;

    const pages = extractionData.pages && extractionData.pages.length > 0
      ? extractionData.pages
      : [{ page: 1, text: extractionData.full_text || '' }];

    for (const pageObj of pages) {
      const pageNum = pageObj.page || 1;
      const rawText = pageObj.text || '';
      if (!rawText.trim()) continue;

      const pageChunks = this.splitPageIntoStructuralChunks(rawText, pageNum, targetChunkSize);

      for (const item of pageChunks) {
        chunks.push({
          chunk_index: globalChunkIndex++,
          page_number: pageNum,
          section_title: item.sectionTitle || `Page ${pageNum}`,
          content: item.text,
          token_count: Math.ceil(item.text.length / 4)
        });
      }
    }

    return chunks;
  },

  splitPageIntoStructuralChunks(rawText, pageNum, targetChunkSize = 800) {
    const lines = rawText.split(/\r?\n/);
    const paragraphsWithHeadings = [];
    let currentHeading = `Page ${pageNum}`;

    let currentParaLines = [];

    const isHeading = (line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.length > 120) return false;
      if (/^(?:#{1,6}\s+|section\s+\d+|chapter\s+\d+|\d+\.\d*\s+)/i.test(trimmed)) return true;
      if (trimmed.endsWith(':') && trimmed.length < 80) return true;
      if (trimmed === trimmed.toUpperCase() && trimmed.length > 3 && /[A-Z]/.test(trimmed)) return true;
      return false;
    };

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) {
        if (currentParaLines.length > 0) {
          paragraphsWithHeadings.push({
            heading: currentHeading,
            text: currentParaLines.join(' ')
          });
          currentParaLines = [];
        }
        continue;
      }

      if (isHeading(trimmed)) {
        if (currentParaLines.length > 0) {
          paragraphsWithHeadings.push({
            heading: currentHeading,
            text: currentParaLines.join(' ')
          });
          currentParaLines = [];
        }
        currentHeading = trimmed.replace(/^#{1,6}\s+/, '').replace(/:$/, '').trim() || `Page ${pageNum}`;
      } else {
        currentParaLines.push(trimmed);
      }
    }

    if (currentParaLines.length > 0) {
      paragraphsWithHeadings.push({
        heading: currentHeading,
        text: currentParaLines.join(' ')
      });
    }

    // Combine paragraphs into chunks up to targetChunkSize without breaking mid-sentence
    const chunks = [];
    let currentChunkHeading = `Page ${pageNum}`;
    let currentChunkText = '';

    for (const item of paragraphsWithHeadings) {
      const cleaned = this.cleanText(item.text);
      if (!cleaned) continue;

      if (!currentChunkText) {
        currentChunkHeading = item.heading;
        currentChunkText = cleaned;
      } else if (currentChunkText.length + cleaned.length + 1 <= targetChunkSize) {
        currentChunkText += ' ' + cleaned;
      } else {
        chunks.push({
          sectionTitle: currentChunkHeading,
          text: currentChunkText.trim()
        });
        currentChunkHeading = item.heading;
        currentChunkText = cleaned;
      }
    }

    if (currentChunkText.trim()) {
      chunks.push({
        sectionTitle: currentChunkHeading,
        text: currentChunkText.trim()
      });
    }

    return chunks;
  },

  cleanText(str) {
    if (!str) return '';
    return str
      .replace(/^#{1,6}\s+/gm, '')
      .replace(/^>\s+/gm, '')
      .replace(/```[\s\S]*?```/g, '')
      .replace(/[`*_\\]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }
};

module.exports = chunkerService;
