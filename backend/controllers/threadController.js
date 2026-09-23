const threadModel = require('../models/threadModel');
const sessionModel = require('../models/sessionModel');
const chunkModel = require('../models/chunkModel');
const userModel = require('../models/userModel');
const chatModel = require('../models/chatModel');
const embeddingService = require('../services/embeddingService');
const faissService = require('../services/faissService');
const grokService = require('../services/grokService');
const documentImageModel = require('../models/documentImageModel');
const { generateImageToken } = require('../middleware/authMiddleware');

const threadController = {
  async listBySession(req, res) {
    try {
      const userId = req.userId;
      const sessionId = req.params.sessionId || req.params.id;
      const threads = await threadModel.getBySession(sessionId, userId);
      res.json(threads);
    } catch (err) {
      console.error('Thread listBySession error:', err.message);
      res.status(500).json({ error: 'Failed to list session threads.' });
    }
  },

  async listRecent(req, res) {
    try {
      const userId = req.userId;
      const limit = parseInt(req.query.limit || '10', 10);
      const threads = await threadModel.getByUserRecent(userId, limit);
      res.json(threads);
    } catch (err) {
      console.error('Thread listRecent error:', err.message);
      res.status(500).json({ error: 'Failed to fetch recent threads.' });
    }
  },

  async getMessages(req, res) {
    try {
      const userId = req.userId;
      const threadId = req.params.threadId || req.params.id;
      const thread = await threadModel.getById(threadId, userId);
      if (!thread) {
        return res.status(404).json({ error: 'Chat thread not found.' });
      }
      const messages = await threadModel.getMessages(threadId);

      // Refresh image tokens so past messages never fail with 401 Unauthorized
      const refreshedMessages = messages.map(msg => {
        if (msg.images) {
          let imgList = [];
          try {
            imgList = typeof msg.images === 'string' ? JSON.parse(msg.images) : msg.images;
          } catch (e) {}

          if (Array.isArray(imgList) && imgList.length > 0) {
            const freshImages = imgList.map(img => {
              const imgId = img.id || img.imageId;
              return {
                ...img,
                imageUrl: `/api/documents/images/${imgId}?token=${generateImageToken(imgId, userId)}`
              };
            });
            return { ...msg, images: freshImages };
          }
        }
        return msg;
      });

      res.json({
        thread,
        messages: refreshedMessages
      });
    } catch (err) {
      console.error('Thread getMessages error:', err.message);
      res.status(500).json({ error: 'Failed to fetch thread messages.' });
    }
  },

  async postMessage(req, res) {
    try {
      const userId = req.userId;
      const routeThreadId = req.params.threadId;
      const routeSessionId = req.params.sessionId;

      let threadId = routeThreadId;
      let sessionId = routeSessionId || req.body.sessionId || req.body.session_id;
      const question = req.body.question || req.body.query;

      if (!question || !question.trim()) {
        return res.status(400).json({ error: 'Question / query cannot be empty.' });
      }

      let thread = null;

      if (routeSessionId || !threadId || threadId === 'new' || threadId === 'create') {
        if (!sessionId) {
          sessionId = await sessionModel.ensureGeneralSession(userId);
        }

        const cleanQuestion = question.trim();
        const derivedTitle = cleanQuestion.length > 50 ? cleanQuestion.substring(0, 47) + '...' : cleanQuestion;
        thread = await threadModel.createThread(sessionId, userId, derivedTitle);
        threadId = thread.id;
      } else {
        thread = await threadModel.getById(threadId, userId);
        if (!thread) {
          return res.status(404).json({ error: 'Chat thread not found.' });
        }
        sessionId = thread.session_id;

        if (!thread.title) {
          const cleanQuestion = question.trim();
          const derivedTitle = cleanQuestion.length > 50 ? cleanQuestion.substring(0, 47) + '...' : cleanQuestion;
          await threadModel.updateTitle(threadId, userId, derivedTitle);
          thread.title = derivedTitle;
        }
      }

      // Save user question to database
      await threadModel.addMessage(threadId, 'user', question.trim());

      // 1. Retrieve Grok API Key
      const user = await userModel.findById(userId);
      const userApiKey = user ? user.grok_api_key : null;
      const apiKey = (userApiKey && userApiKey.trim().length > 5) ? userApiKey.trim() : (process.env.GROK_API_KEY || '').trim();

      // 2. Load conversation history for thread context
      const existingMessages = await threadModel.getMessages(threadId);
      const conversationHistory = (existingMessages || []).map(m => ({
        role: m.role,
        content: m.content
      })).slice(-8);

      // 3. Retrieve session-scoped chunks
      const userChunks = await chunkModel.getByUser(userId, null, sessionId);

      if (!userChunks || userChunks.length === 0) {
        const noDocsAnswer = "You haven't uploaded any documents into this session yet. Upload a PDF or DOCX file to this session to ask questions!";
        await threadModel.addMessage(threadId, 'assistant', noDocsAnswer, [], []);
        return res.json({
          threadId: thread.id,
          title: thread.title || 'New Chat',
          question: question.trim(),
          answer: noDocsAnswer,
          sources: [],
          citations: [],
          images: []
        });
      }

      // 4. Perform session-scoped Hybrid Retrieval (Keyword + Vector)
      const baseTokens = embeddingService.tokenize(question);
      const significantTokens = embeddingService.expandTokens(baseTokens, question);

      let sortedKeywordChunks = [];
      if (significantTokens.length > 0) {
        try {
          sortedKeywordChunks = await chunkModel.searchByKeywords(userId, significantTokens, null, 15, sessionId);
        } catch (kwErr) {
          console.warn('[Session Keyword Search Warning]:', kwErr.message);
        }
      }

      const queryVec = await embeddingService.generateEmbedding(question.trim());
      const vectorMatches = await faissService.searchIndex(userId, queryVec, 15);

      // Map vector index to chunks and filter strictly for current session
      const vectorMatchedChunks = vectorMatches
        .map(m => userChunks[m.index])
        .filter(c => c && String(c.session_id) === String(sessionId));

      const mergedCandidateMap = new Map();
      (sortedKeywordChunks || []).forEach(c => mergedCandidateMap.set(c.id, c));
      (vectorMatchedChunks || []).forEach(c => {
        if (!mergedCandidateMap.has(c.id)) mergedCandidateMap.set(c.id, c);
      });

      let candidates = Array.from(mergedCandidateMap.values());

      // Simple scoring / fallback
      let contextChunks = candidates.slice(0, 12);
      let isFallbackContext = false;

      if (contextChunks.length === 0) {
        contextChunks = [...userChunks].slice(0, 3);
        isFallbackContext = true;
      }

      // 5. Synthesize via Grok Service
      const grokResponse = await grokService.askQuestion({
        question: question.trim(),
        contextChunks,
        conversationHistory,
        userApiKey: apiKey,
        isFallbackContext
      });

      const sources = (grokResponse.citations || []).map(c => ({
        source_id: c.source_id,
        documentName: c.document_title,
        page: c.page_number,
        snippet: c.snippet
      }));

      // 6. Visual intent check for image attachments
      const visualKeywordsPattern = /\b(?:diagram|diagrams|picture|pictures|image|images|figure|figures|chart|charts|graph|graphs|illustration|illustrations|show|shows|showing|visual|visuals|screenshot|screenshots|draw|drawing|photo|photos|map|maps|flowchart|architecture)\b/i;
      const hasVisualIntent = visualKeywordsPattern.test(question);

      let matchedImages = [];
      if (hasVisualIntent) {
        try {
          const targetDocPages = (grokResponse.citations && grokResponse.citations.length > 0 ? grokResponse.citations : contextChunks.slice(0, 5)).map(item => ({
            documentId: item.document_id,
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
        } catch (imgErr) {
          console.warn('[Thread Image Lookup Warning]:', imgErr.message);
        }
      }

      // 7. Save assistant answer to database
      await threadModel.addMessage(
        threadId,
        'assistant',
        grokResponse.answer,
        sources,
        matchedImages
      );

      // Also record to main chat_history table for universal Chat History page
      try {
        await chatModel.save({
          userId,
          sessionId: thread.session_id,
          threadId: thread.id,
          documentId: null,
          question: question.trim(),
          answer: grokResponse.answer,
          citations: grokResponse.citations
        });
      } catch (histSaveErr) {
        console.warn('[Chat History Record Warning]:', histSaveErr.message);
      }

      return res.json({
        threadId: thread.id,
        title: thread.title || 'New Chat',
        question: question.trim(),
        answer: grokResponse.answer,
        sources,
        citations: grokResponse.citations,
        images: matchedImages,
        engine: grokResponse.engine
      });

    } catch (err) {
      console.error('Thread postMessage error:', err.message);
      res.status(500).json({ error: err.message || 'An error occurred while processing your message.' });
    }
  }
};

module.exports = threadController;
