const { IndexFlatL2 } = require('faiss-node');
const path = require('path');
const fs = require('fs');
const embeddingService = require('./embeddingService');

const VECTOR_DIM = 512;
const indexesDir = path.join(__dirname, '../data/indexes');

if (!fs.existsSync(indexesDir)) {
  fs.mkdirSync(indexesDir, { recursive: true });
}

const faissService = {
  VECTOR_DIM,

  getUserIndexFilePath(userId) {
    return path.join(indexesDir, `user_${userId}.index`);
  },

  getUserMetaFilePath(userId) {
    return path.join(indexesDir, `user_${userId}.meta.json`);
  },

  getIndexMetadata(userId) {
    const metaFile = this.getUserMetaFilePath(userId);
    if (!fs.existsSync(metaFile)) return null;
    try {
      const data = fs.readFileSync(metaFile, 'utf8');
      return JSON.parse(data);
    } catch (e) {
      return null;
    }
  },

  saveIndexMetadata(userId, metaData) {
    const metaFile = this.getUserMetaFilePath(userId);
    try {
      fs.writeFileSync(metaFile, JSON.stringify(metaData, null, 2), 'utf8');
    } catch (e) {
      console.error(`Failed to save FAISS metadata for user ${userId}:`, e.message);
    }
  },

  /**
   * Adds new vectors to the user's FAISS index and persists it to disk with sidecar metadata.
   */
  async buildIndex(userId, vectors) {
    const indexFile = this.getUserIndexFilePath(userId);
    const metaFile = this.getUserMetaFilePath(userId);

    if (!Array.isArray(vectors) || vectors.length === 0) {
      if (fs.existsSync(indexFile)) {
        try { fs.unlinkSync(indexFile); } catch (e) {}
      }
      if (fs.existsSync(metaFile)) {
        try { fs.unlinkSync(metaFile); } catch (e) {}
      }
      return { success: true, count: 0 };
    }

    const index = new IndexFlatL2(VECTOR_DIM);

    const flatVectors = [];
    for (const v of vectors) {
      const vecArray = Array.isArray(v) ? v : (v.embedding || v.vector);
      if (vecArray && vecArray.length === VECTOR_DIM) {
        flatVectors.push(...vecArray);
      }
    }

    if (flatVectors.length > 0) {
      index.add(flatVectors);
      index.write(indexFile);
      this.saveIndexMetadata(userId, {
        dimension: VECTOR_DIM,
        totalItems: index.ntotal(),
        updatedAt: new Date().toISOString()
      });
    }

    return {
      success: true,
      total_items: index.ntotal(),
      added_items: vectors.length
    };
  },

  /**
   * Rebuilds user FAISS index from an ordered list of chunk texts or chunk objects.
   * Generates new 512-dim vectors, updates sidecar metadata, and returns generated embeddings.
   */
  async rebuildIndex(userId, chunkTexts) {
    const textArray = chunkTexts.map(t => typeof t === 'string' ? t : (t.content || ''));
    const embeddings = await embeddingService.generateEmbeddings(textArray);

    await this.buildIndex(userId, embeddings);

    return {
      success: true,
      total_items: embeddings.length,
      embeddings
    };
  },

  /**
   * Performs FAISS similarity search for a query vector in the user's index.
   * Checks sidecar metadata to ensure dimension match before searching.
   */
  async searchIndex(userId, queryVector, topK = 5) {
    const indexFile = this.getUserIndexFilePath(userId);
    if (!fs.existsSync(indexFile)) {
      return [];
    }

    // Verify sidecar metadata dimension match
    const meta = this.getIndexMetadata(userId);
    if (!meta || meta.dimension !== VECTOR_DIM) {
      console.warn(`[FAISS] Dimension mismatch or missing metadata for user ${userId} (expected ${VECTOR_DIM}, got ${meta ? meta.dimension : 'none'}). Returning empty result.`);
      return [];
    }

    if (!Array.isArray(queryVector) || queryVector.length !== VECTOR_DIM) {
      console.warn(`[FAISS] Search query vector dimension mismatch (${queryVector ? queryVector.length : 0} != ${VECTOR_DIM}).`);
      return [];
    }

    try {
      const index = IndexFlatL2.read(indexFile);
      const total = index.ntotal();
      if (total === 0) return [];

      const k = Math.min(topK, total);
      const searchRes = index.search(queryVector, k);

      const results = [];
      if (searchRes && searchRes.labels) {
        for (let i = 0; i < searchRes.labels.length; i++) {
          const label = searchRes.labels[i];
          const dist = searchRes.distances[i];
          if (label !== -1) {
            const score = Math.max(0, (2.0 - dist) / 2.0);
            results.push({
              index: label,
              distance: dist,
              score
            });
          }
        }
      }
      return results;
    } catch (err) {
      console.error(`FAISS search error for user ${userId}:`, err.message);
      return [];
    }
  }
};

module.exports = faissService;
