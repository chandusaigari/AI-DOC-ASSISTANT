const embeddingService = require('../services/embeddingService');
const faissService = require('../services/faissService');
const grokService = require('../services/grokService');
const chunkModel = require('../models/chunkModel');
const chatModel = require('../models/chatModel');
const userModel = require('../models/userModel');
const documentImageModel = require('../models/documentImageModel');
const { generateImageToken } = require('../middleware/authMiddleware');

const chatController = {
  async ask(req, res) {
    try {
      const question = req.body.query || req.body.question;
      const documentId = req.body.document_id || req.body.documentId || null;
      const userId = req.userId;

      if (!question || !question.trim()) {
        return res.status(400).json({ error: 'Question / query cannot be empty.' });
      }

      // 1. Retrieve Grok API Key (optional - local synthesis fallback available)
      const user = await userModel.findById(userId);
      const userApiKey = user ? user.grok_api_key : null;
      const apiKey = (userApiKey && userApiKey.trim().length > 5) ? userApiKey.trim() : (process.env.GROK_API_KEY || '').trim();

      // 2. Retrieve conversation history for follow-ups and context memory
      let conversationHistory = [];
      if (Array.isArray(req.body.history) && req.body.history.length > 0) {
        conversationHistory = req.body.history.map(item => {
          if (item.role && item.content) {
            return { role: item.role, content: item.content };
          } else if (item.question || item.answerText || item.answer) {
            const pair = [];
            if (item.question) pair.push({ role: 'user', content: item.question });
            if (item.answerText || item.answer) pair.push({ role: 'assistant', content: item.answerText || item.answer });
            return pair;
          }
          return null;
        }).flat().filter(Boolean);
      } else {
        const rawHistory = await chatModel.getHistory(userId);
        conversationHistory = (rawHistory || []).reverse().map(h => [
          { role: 'user', content: h.question },
          { role: 'assistant', content: h.answer }
        ]).flat();
      }

      const lastUserTurn = [...conversationHistory].reverse().find(m => m.role === 'user' || m.question);
      const lastQuestion = lastUserTurn ? (lastUserTurn.content || lastUserTurn.question || '') : '';

      // 3. Retrieve user document chunks
      let userChunks = await chunkModel.getByUser(userId, documentId);
      if (!userChunks || userChunks.length === 0) {
        return res.json({
          question: question.trim(),
          answer: 'You have not uploaded any documents yet. Please upload a PDF or DOCX file first to ask questions.',
          sources: [],
          citations: []
        });
      }

      if (documentId) {
        userChunks = userChunks.filter(c => String(c.document_id) === String(documentId));
      }

      let contextChunks = [];

      // 4. Check for direct page number query pattern ("page 3", "pg 1", "page number 2", "p. 4")
      const pageMatch = question.match(/\b(?:page|pg|page\s+number|p\.)\s*#?\s*(\d+)\b/i);

      if (pageMatch) {
        const targetPage = parseInt(pageMatch[1], 10);
        console.log(`[Page Lookup] Direct query for Page ${targetPage}`);
        const pageChunks = await chunkModel.getByPage(userId, targetPage, documentId);

        if (!pageChunks || pageChunks.length === 0) {
          return res.json({
            question: question.trim(),
            answer: `I couldn't find page ${targetPage} in your uploaded documents.`,
            sources: [],
            citations: []
          });
        }

        contextChunks = pageChunks;
      } else {
        // 5. Query Expansion for Follow-up Questions
        const isFollowUpPattern = /\b(?:that|this|it|second|2nd|first|1st|third|3rd|more|detail|details|tell|elaborate|table|summary|summarize|compare|difference|differences|previous|last|above|mentioned|bullet|bullets|list)\b/i;
        let retrievalQuery = question.trim();

        if (lastQuestion && (isFollowUpPattern.test(question) || question.trim().length < 25)) {
          retrievalQuery = `${lastQuestion} - ${question.trim()}`;
          console.log(`[Follow-Up Expanded Retrieval Query]: "${retrievalQuery}"`);
        }

        // 6. Detect Depth/Detail Questions
        const isDetailQuestion = /\b(?:detail|details|explain|information|walk\s+through|elaborate|comprehensive|deep\s+dive|overview|summary|summarize|table|compare)\b/i.test(question);
        const topKCount = isDetailQuestion ? 15 : 8;

        // 7. Extract significant tokens (stopword-filtered) & expand abbreviations
        const baseTokens = embeddingService.tokenize(retrievalQuery);
        const significantTokens = embeddingService.expandTokens(baseTokens, retrievalQuery);
        console.log(`[Tokenizer] Question: "${retrievalQuery}" -> Base tokens:`, baseTokens, `Expanded tokens:`, significantTokens);

        // 8. Hybrid Retrieval Step A: Scored Literal Keyword Search Safety Net (Top 15 Candidate Limit)
        let sortedKeywordChunks = [];
        if (significantTokens.length > 0) {
          try {
            const dbKeywordHits = await chunkModel.searchByKeywords(userId, significantTokens, documentId, 15);
            if (dbKeywordHits && dbKeywordHits.length > 0) {
              sortedKeywordChunks = dbKeywordHits;
            }
          } catch (dbErr) {
            console.warn('[Keyword DB Search Fallback]:', dbErr.message);
          }

          if (sortedKeywordChunks.length === 0) {
            const keywordMatchedMap = new Map();
            userChunks.forEach(chunk => {
              const contentLower = (chunk.content || '').toLowerCase();
              let matches = 0;
              significantTokens.forEach(token => {
                if (contentLower.includes(token)) matches++;
              });

              if (matches > 0) {
                const matchRatio = matches / significantTokens.length;
                keywordMatchedMap.set(chunk.id, { chunk, matchRatio, matches });
              }
            });

            sortedKeywordChunks = Array.from(keywordMatchedMap.values())
              .sort((a, b) => (b.matches - a.matches) || (b.matchRatio - a.matchRatio))
              .map(item => item.chunk)
              .slice(0, 15);
          }
        }

        // 9. Hybrid Retrieval Step B: FAISS Vector Similarity Search
        const queryVec = await embeddingService.generateEmbedding(retrievalQuery);
        const matches = await faissService.searchIndex(userId, queryVec, topKCount);

        console.log(`[FAISS Search] Query: "${question.trim()}" | Vector matches: ${matches.length}`);

        const MIN_SIMILARITY_SCORE = 0.05;
        const relevantVectorMatches = matches.filter(m => m.score >= MIN_SIMILARITY_SCORE);
        const vectorMatchedChunks = relevantVectorMatches.map(m => userChunks[m.index]).filter(Boolean);

        // 10. Merge Scored Keyword Hits First, then Vector Hits (Deduplicated)
        const mergedCandidateMap = new Map();

        // Exact Keyword hits with highest match score first
        sortedKeywordChunks.forEach(c => mergedCandidateMap.set(c.id, c));

        // Vector hits second
        vectorMatchedChunks.forEach(c => {
          if (!mergedCandidateMap.has(c.id)) {
            mergedCandidateMap.set(c.id, c);
          }
        });

        // Optional neighbor expansion for detail / table / summary questions
        if (isDetailQuestion) {
          const baseCandidates = Array.from(mergedCandidateMap.values());
          baseCandidates.forEach(matchedChunk => {
            const matchedDocId = matchedChunk.document_id;
            const matchedChunkIdx = matchedChunk.chunk_index;

            userChunks.forEach(c => {
              if (c.document_id === matchedDocId && Math.abs(c.chunk_index - matchedChunkIdx) <= 1) {
                if (!mergedCandidateMap.has(c.id)) {
                  mergedCandidateMap.set(c.id, c);
                }
              }
            });
          });
        }

        let candidates = Array.from(mergedCandidateMap.values());

        // 11. Re-Ranking & Deduplication
        contextChunks = chatController.rerankAndDeduplicate(question.trim(), candidates);

        let isFallbackContext = false;
        if (contextChunks.length === 0) {
          if (documentId && userChunks.length > 0) {
            console.log(`[Document Fallback] Scoped query on document ${documentId} returned no direct hits. Using first 3 opening passages as fallback context.`);
            contextChunks = [...userChunks].sort((a, b) => (a.chunk_index || 0) - (b.chunk_index || 0)).slice(0, 3);
            isFallbackContext = true;
          } else {
            return res.json({
              question: question.trim(),
              answer: "I couldn't find anything about that in your uploaded documents.",
              sources: [],
              citations: []
            });
          }
        }

        // Cap context passages to top 12
        contextChunks = contextChunks.slice(0, 12);

        // 12. Synthesize answer with Grok API or Local RAG Fallback
        const grokResponse = await grokService.askQuestion({
          question: question.trim(),
          contextChunks,
          conversationHistory,
          userApiKey: apiKey,
          isFallbackContext
        });

        // Clear citations/sources if AI answer explicitly indicates nothing was found or if using fallback context
        const notFoundPattern = /\b(?:couldn't find|could not find|no information|do not contain|does not contain|not mentioned|not provided|does not cover|does not contain information)\b/i;
        let finalCitations = isFallbackContext ? [] : (grokResponse.citations || []);
        if (notFoundPattern.test(grokResponse.answer)) {
          finalCitations = [];
        }

        // 13. Save query and response to chat history
        const chatId = await chatModel.save({
          userId,
          documentId,
          question: question.trim(),
          answer: grokResponse.answer,
          citations: finalCitations
        });

        const sources = finalCitations.map(c => ({
          source_id: c.source_id,
          documentName: c.document_title,
          page: c.page_number,
          snippet: c.snippet
        }));

        // Visual intent check: only attach extracted page images if user question explicitly requests visual/diagram content
        const visualKeywordsPattern = /\b(?:diagram|diagrams|picture|pictures|image|images|figure|figures|chart|charts|graph|graphs|illustration|illustrations|show|shows|showing|visual|visuals|screenshot|screenshots|draw|drawing|photo|photos|map|maps|flowchart|architecture)\b/i;
        const hasVisualIntent = visualKeywordsPattern.test(question);

        let matchedImages = [];
        if (hasVisualIntent) {
          try {
            const targetDocPages = (finalCitations && finalCitations.length > 0 ? finalCitations : contextChunks.slice(0, 5)).map(item => ({
              documentId: item.document_id || documentId,
              page: item.page_number || item.page || 1
            })).filter(pair => pair.documentId);

            if (targetDocPages.length > 0) {
              const rawImages = await documentImageModel.getByUserAndDocPages(userId, targetDocPages);
              const seenImageIds = new Set();
              matchedImages = rawImages.filter(img => {
                if (seenImageIds.has(img.id)) return false;
                seenImageIds.add(img.id);
                return true;
              }).slice(0, 3).map(img => ({
                id: img.id,
                imageId: img.id,
                imageUrl: `/api/documents/images/${img.id}?token=${generateImageToken(img.id, userId)}`,
                page: img.page,
                documentName: img.document_title || img.original_filename
              }));
            }
          } catch (imgLookupErr) {
            console.warn('[Chat Image Retrieval Warning]:', imgLookupErr.message);
          }
        }

        return res.json({
          id: chatId,
          question: question.trim(),
          answer: grokResponse.answer,
          sources,
          images: matchedImages,
          citations: finalCitations,
          engine: grokResponse.engine
        });
      }
    } catch (err) {
      console.error('Chat controller error:', err.message);
      res.status(500).json({ error: err.message || "An error occurred while processing your request." });
    }
  },

  rerankAndDeduplicate(query, chunks) {
    if (!chunks || chunks.length === 0) return [];

    const queryWords = new Set(embeddingService.tokenize(query));

    const scored = chunks.map(chunk => {
      const contentLower = (chunk.content || '').toLowerCase();
      let overlapCount = 0;
      queryWords.forEach(w => {
        if (contentLower.includes(w)) overlapCount++;
      });
      const overlapScore = queryWords.size > 0 ? overlapCount / queryWords.size : 0;

      return {
        chunk,
        rankScore: overlapScore
      };
    });

    // Keep highest rankScore first
    scored.sort((a, b) => b.rankScore - a.rankScore);

    const selected = [];
    for (const item of scored) {
      const text = item.chunk.content || '';
      const isDuplicate = selected.some(s => {
        const otherText = s.content || '';
        const minLen = Math.min(text.length, otherText.length);
        if (minLen === 0) return false;
        return text.includes(otherText.substring(0, Math.floor(minLen * 0.7)));
      });

      if (!isDuplicate) {
        selected.push(item.chunk);
      }
    }

    return selected;
  },

  async getHistory(req, res) {
    try {
      const history = await chatModel.getHistory(req.userId);
      res.json(history);
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch chat history.' });
    }
  },

  async clearHistory(req, res) {
    try {
      await chatModel.clearHistory(req.userId);
      res.json({ message: 'Chat history cleared successfully.' });
    } catch (err) {
      res.status(500).json({ error: 'Failed to clear chat history.' });
    }
  }
};

module.exports = chatController;
