const path = require('path');
const fs = require('fs');
const documentModel = require('../models/documentModel');
const chunkModel = require('../models/chunkModel');
const documentImageModel = require('../models/documentImageModel');
const extractorService = require('../services/extractorService');
const imageExtractorService = require('../services/imageExtractorService');
const chunkerService = require('../services/chunkerService');
const embeddingService = require('../services/embeddingService');
const faissService = require('../services/faissService');

const sessionModel = require('../models/sessionModel');
const { generateImageToken } = require('../middleware/authMiddleware');

const documentController = {
  async uploadDocument(req, res) {
    if (!req.file) {
      return res.status(400).json({ error: 'Please select a document to upload (PDF or DOCX).' });
    }

    const userId = req.userId;
    const originalFilename = req.file.originalname;
    const filePath = req.file.path;
    const fileType = path.extname(originalFilename).toLowerCase().replace('.', '');
    const fileSize = req.file.size;
    const title = req.body.title || path.basename(originalFilename, path.extname(originalFilename));
    let sessionId = req.body.sessionId || req.body.session_id || null;

    if (!sessionId) {
      sessionId = await sessionModel.ensureGeneralSession(userId);
    }

    // 1. Initial document record in DB with status = 'processing'
    const documentId = await documentModel.create({
      userId,
      sessionId,
      title,
      originalFilename,
      filePath,
      fileType,
      fileSize,
      totalPages: 0,
      extractedText: ''
    });

    await documentModel.updateStatus(documentId, 'processing');

    try {
      // 2. Extract raw text page-by-page (PDF via pdf-parse / DOCX via mammoth natively in Node.js)
      const extraction = await extractorService.extractText(filePath, fileType);

      // 2b. Extract embedded document images (DOCX via mammoth / PDF via pdf-poppler with graceful fallback)
      let extractedImages = [];
      try {
        extractedImages = await imageExtractorService.extractAndSaveImages(documentId, userId, filePath, fileType);
      } catch (imgErr) {
        console.warn(`[Image Extraction Non-Fatal Warning] Doc #${documentId}:`, imgErr.message);
      }

      // 3. Create overlapping passages (~500 tokens, 50-token overlap)
      const chunkDataList = chunkerService.createChunks(extraction);

      // 4. Generate embeddings (512-dim stopword-filtered tokenizer)
      const textArray = chunkDataList.map(c => c.content);
      const embeddings = await embeddingService.generateEmbeddings(textArray);

      // 5. Save chunks into document_chunks table
      const chunksWithEmbeddings = chunkDataList.map((c, i) => ({
        ...c,
        document_id: documentId,
        user_id: userId,
        embedding_vector: embeddings[i]
      }));

      await chunkModel.insertBatch(chunksWithEmbeddings);
      await documentModel.updateChunkCount(documentId, chunksWithEmbeddings.length);
      await documentModel.updateStatus(documentId, 'ready', extraction.total_pages || 1, extraction.full_text || '');

      // 6. Rebuild user FAISS vector index
      const allUserChunks = await chunkModel.getByUser(userId);
      const allChunkTexts = allUserChunks.map(c => c.content || '');

      if (allChunkTexts.length > 0) {
        await faissService.rebuildIndex(userId, allChunkTexts);
      }

      res.status(201).json({
        message: 'Document uploaded and semantically indexed successfully.',
        document: {
          id: documentId,
          title,
          originalFilename,
          fileType,
          fileSize,
          status: 'processed',
          totalPages: extraction.total_pages || 1,
          totalChunks: chunksWithEmbeddings.length
        }
      });
    } catch (err) {
      console.error('Error during document processing pipeline:', err);
      await documentModel.updateStatus(documentId, 'failed');
      res.status(500).json({ error: err.message || 'Failed to process document.' });
    }
  },

  async reindexDocuments(req, res) {
    try {
      const userId = req.userId;
      const chunks = await chunkModel.getByUser(userId);

      if (!chunks || chunks.length === 0) {
        return res.json({
          success: true,
          reindexedChunks: 0,
          message: 'No document chunks found to reindex.'
        });
      }

      // 1. Re-embed all chunks with 512-dim stopword-filtered tokenizer
      const chunkTexts = chunks.map(c => c.content || '');
      const newEmbeddings = await embeddingService.generateEmbeddings(chunkTexts);

      // 2. Update DB document_chunks embedding_vector column
      for (let i = 0; i < chunks.length; i++) {
        await chunkModel.updateEmbedding(chunks[i].id, newEmbeddings[i]);
      }

      // 3. Rebuild FAISS index and sidecar metadata file with 512-dim
      await faissService.rebuildIndex(userId, chunkTexts);

      res.json({
        success: true,
        reindexedChunks: chunks.length,
        message: `Successfully reindexed ${chunks.length} document passages into 512-dim FAISS index.`
      });
    } catch (err) {
      console.error('Reindex documents error:', err);
      res.status(500).json({ error: 'Failed to reindex documents: ' + err.message });
    }
  },

  async getDocuments(req, res) {
    try {
      const search = req.query.search || '';
      const docs = await documentModel.getAllByUser(req.userId, search);
      res.json(docs);
    } catch (err) {
      res.status(500).json({ error: 'Failed to retrieve documents.' });
    }
  },

  async getDocumentById(req, res) {
    try {
      const doc = await documentModel.getById(req.params.id, req.userId);
      if (!doc) {
        return res.status(404).json({ error: 'Document not found.' });
      }
      const chunks = await chunkModel.getByDocument(req.params.id, req.userId);
      res.json({ document: doc, chunks });
    } catch (err) {
      res.status(500).json({ error: 'Failed to retrieve document details.' });
    }
  },

  async toggleFavorite(req, res) {
    try {
      const newFavState = await documentModel.toggleFavorite(req.params.id, req.userId);
      if (newFavState === null) {
        return res.status(404).json({ error: 'Document not found.' });
      }
      res.json({ message: 'Favorite state updated.', is_favorite: newFavState });
    } catch (err) {
      res.status(500).json({ error: 'Failed to update favorite status.' });
    }
  },

  async deleteDocument(req, res) {
    try {
      const doc = await documentModel.getById(req.params.id, req.userId);
      if (!doc) {
        return res.status(404).json({ error: 'Document not found.' });
      }

      if (fs.existsSync(doc.file_path)) {
        try { fs.unlinkSync(doc.file_path); } catch (e) {}
      }

      await documentModel.delete(req.params.id, req.userId);
      await documentImageModel.deleteByDocument(req.params.id, req.userId);
      imageExtractorService.deleteDocumentImages(req.params.id);

      const remainingChunks = await chunkModel.getByUser(req.userId);
      const remainingTexts = remainingChunks.map(c => c.content || '');

      await faissService.rebuildIndex(req.userId, remainingTexts);

      res.json({ message: 'Document, images, and associated vector index deleted successfully.' });
    } catch (err) {
      console.error('Delete document error:', err);
      res.status(500).json({ error: 'Failed to delete document.' });
    }
  },

  async getImageById(req, res) {
    try {
      const imageId = req.params.imageId;
      const img = await documentImageModel.getById(imageId, req.userId);
      if (!img) {
        return res.status(404).json({ error: 'Image not found or unauthorized.' });
      }
      if (!fs.existsSync(img.file_path)) {
        return res.status(404).json({ error: 'Image file does not exist on disk.' });
      }
      res.sendFile(path.resolve(img.file_path));
    } catch (err) {
      console.error('Get image error:', err);
      res.status(500).json({ error: 'Failed to retrieve image.' });
    }
  },

  async getDocumentImages(req, res) {
    try {
      const images = await documentImageModel.getByDocument(req.params.id, req.userId);
      res.json(images.map(img => ({
        id: img.id,
        documentId: img.document_id,
        page: img.page,
        imageUrl: `/api/documents/images/${img.id}?token=${generateImageToken(img.id, req.userId)}`,
        documentTitle: img.document_title || img.original_filename
      })));
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch document images.' });
    }
  },

  async getStats(req, res) {
    try {
      const stats = await documentModel.getStats(req.userId);
      res.json(stats);
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch dashboard statistics.' });
    }
  },

  async getRecent(req, res) {
    try {
      const docs = await documentModel.getAllByUser(req.userId, '');
      res.json(docs.slice(0, 5));
    } catch (err) {
      res.status(500).json({ error: 'Failed to retrieve recent documents.' });
    }
  }
};

module.exports = documentController;
