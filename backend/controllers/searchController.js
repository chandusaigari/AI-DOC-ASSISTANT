const embeddingService = require('../services/embeddingService');
const faissService = require('../services/faissService');
const chunkModel = require('../models/chunkModel');
const documentImageModel = require('../models/documentImageModel');
const { generateImageToken } = require('../middleware/authMiddleware');

const searchController = {
  async search(req, res) {
    try {
      const query = req.query.q || req.query.query || req.body.query || req.body.q;
      const topK = parseInt(req.query.topK || req.body.topK || '8', 10);
      const documentId = req.query.document_id || req.query.documentId || req.body.document_id || req.body.documentId || null;
      const sessionId = req.query.session_id || req.query.sessionId || req.body.session_id || req.body.sessionId || null;
      const userId = req.userId;

      if (!query || !query.trim()) {
        return res.status(400).json({ error: 'Search query cannot be empty.' });
      }

      // 1. Tokenize query to extract significant words (excluding stopwords) & expand abbreviations
      const baseTokens = embeddingService.tokenize(query);
      const significantTokens = embeddingService.expandTokens(baseTokens, query);
      const queryVec = await embeddingService.generateEmbedding(query);

      // 2. Fetch user document chunks
      let userChunks = await chunkModel.getByUser(userId, documentId, sessionId);

      if (!userChunks || userChunks.length === 0) {
        return res.json({ results: [], message: 'No documents found matching this scope.' });
      }

      if (sessionId) {
        userChunks = userChunks.filter(c => String(c.session_id) === String(sessionId));
      }

      if (documentId) {
        userChunks = userChunks.filter(c => String(c.document_id) === String(documentId));
      }

      const resultsMap = new Map();

      // 3. Literal Keyword Safety Net Search (using significant tokens & match score)
      if (significantTokens.length > 0) {
        const keywordCandidates = [];
        userChunks.forEach(chunk => {
          const contentLower = (chunk.content || '').toLowerCase();
          let matchCount = 0;
          significantTokens.forEach(token => {
            if (contentLower.includes(token)) {
              matchCount++;
            }
          });

          if (matchCount > 0) {
            const matchRatio = matchCount / significantTokens.length;
            const relevanceScore = Math.min(98, Math.round(85 + (matchRatio * 13))); // 85% to 98%
            keywordCandidates.push({
              chunk,
              matchCount,
              matchRatio,
              relevanceScore
            });
          }
        });

        // Sort by matchCount desc, then matchRatio desc
        keywordCandidates.sort((a, b) => (b.matchCount - a.matchCount) || (b.matchRatio - a.matchRatio));

        keywordCandidates.slice(0, 15).forEach(item => {
          const chunk = item.chunk;
          resultsMap.set(chunk.id, {
            chunk_id: chunk.id,
            document_id: chunk.document_id,
            document_title: chunk.document_title || chunk.original_filename,
            section_title: chunk.section_title || `Page ${chunk.page_number}`,
            page_number: chunk.page_number || 1,
            content: chunk.content,
            score: 0.9 + (item.matchRatio * 0.1),
            relevancePercentage: item.relevanceScore,
            matchType: 'keyword'
          });
        });
      }

      // 4. FAISS Vector Similarity Search
      const faissMatches = await faissService.searchIndex(userId, queryVec, topK * 2);

      if (faissMatches && faissMatches.length > 0) {
        faissMatches.forEach(match => {
          const chunk = userChunks[match.index];
          if (chunk) {
            const relevanceScore = Math.max(0, Math.min(100, Math.round(match.score * 100)));
            if (!resultsMap.has(chunk.id)) {
              resultsMap.set(chunk.id, {
                chunk_id: chunk.id,
                document_id: chunk.document_id,
                document_title: chunk.document_title || chunk.original_filename,
                section_title: chunk.section_title || `Page ${chunk.page_number}`,
                page_number: chunk.page_number || 1,
                content: chunk.content,
                score: match.score,
                relevancePercentage: relevanceScore,
                matchType: 'vector'
              });
            } else {
              // Boost existing keyword match score if vector search also matched it
              const existing = resultsMap.get(chunk.id);
              existing.relevancePercentage = Math.max(existing.relevancePercentage, relevanceScore);
              existing.score = Math.max(existing.score, match.score);
              existing.matchType = 'hybrid';
            }
          }
        });
      }

      // 5. Convert to array and sort (Keyword / Hybrid matches first, then by relevancePercentage desc)
      let results = Array.from(resultsMap.values());

      results.sort((a, b) => {
        if (b.relevancePercentage !== a.relevancePercentage) {
          return b.relevancePercentage - a.relevancePercentage;
        }
        return b.score - a.score;
      });

      results = results.slice(0, topK);

      // Attach matching images for each search result item
      const docPagePairs = results.map(r => ({
        documentId: r.document_id,
        page: r.page_number
      }));

      if (docPagePairs.length > 0) {
        try {
          const rawImages = await documentImageModel.getByUserAndDocPages(userId, docPagePairs);
          results.forEach(resItem => {
            const itemImages = rawImages.filter(img =>
              img.document_id === resItem.document_id && (img.page === resItem.page_number || img.page === null)
            ).slice(0, 2).map(img => ({
              id: img.id,
              imageId: img.id,
              imageUrl: `/api/documents/images/${img.id}?token=${generateImageToken(img.id, userId)}`,
              page: img.page,
              documentName: img.document_title || img.original_filename
            }));
            resItem.images = itemImages;
          });
        } catch (imgErr) {
          console.warn('[Search Image Matching Warning]:', imgErr.message);
          results.forEach(r => r.images = []);
        }
      } else {
        results.forEach(r => r.images = []);
      }

      res.json({
        query,
        count: results.length,
        results
      });
    } catch (err) {
      console.error('Hybrid search error:', err);
      res.status(500).json({ error: 'Failed to perform search.' });
    }
  }
};

module.exports = searchController;
