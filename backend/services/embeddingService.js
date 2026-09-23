const VECTOR_DIM = 512;

const STOPWORDS = new Set([
  'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are', 'aren\'t', 'as', 'at',
  'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'by',
  'can', 'can\'t', 'cannot', 'could', 'couldn\'t', 'did', 'didn\'t', 'do', 'does', 'doesn\'t', 'doing', 'don\'t', 'down', 'during',
  'each', 'few', 'for', 'from', 'further',
  'had', 'hadn\'t', 'has', 'hasn\'t', 'have', 'haven\'t', 'having', 'he', 'he\'d', 'he\'ll', 'he\'s', 'her', 'here', 'here\'s', 'hers', 'herself', 'him', 'himself', 'his', 'how', 'how\'s',
  'i', 'i\'d', 'i\'ll', 'i\'m', 'i\'ve', 'if', 'in', 'into', 'is', 'isn\'t', 'it', 'it\'s', 'its', 'itself',
  'let\'s', 'me', 'more', 'most', 'mustn\'t', 'my', 'myself',
  'no', 'nor', 'not', 'of', 'off', 'on', 'once', 'only', 'or', 'other', 'ought', 'our', 'ours', 'ourselves', 'out', 'over', 'own',
  'same', 'shan\'t', 'she', 'she\'d', 'she\'ll', 'she\'s', 'should', 'shouldn\'t', 'so', 'some', 'such',
  'than', 'that', 'that\'s', 'the', 'their', 'theirs', 'them', 'themselves', 'then', 'there', 'there\'s', 'these', 'they', 'they\'d', 'they\'ll', 'they\'re', 'they\'ve', 'this', 'those', 'through', 'to', 'too',
  'under', 'until', 'up', 'very',
  'was', 'wasn\'t', 'we', 'we\'d', 'we\'ll', 'we\'re', 'we\'ve', 'were', 'weren\'t', 'what', 'what\'s', 'when', 'when\'s', 'where', 'where\'s', 'which', 'while', 'who', 'who\'s', 'whom', 'why', 'why\'s', 'with', 'won\'t', 'would', 'wouldn\'t',
  'you', 'you\'d', 'you\'ll', 'you\'re', 'you\'ve', 'your', 'yours', 'yourself', 'yourselves', 'per'
]);

const ABBREVIATIONS = [
  { abbr: 'cn', full: 'computer network' },
  { abbr: 'tcp', full: 'transmission control protocol' },
  { abbr: 'ip', full: 'internet protocol' },
  { abbr: 'os', full: 'operating system' },
  { abbr: 'ai', full: 'artificial intelligence' },
  { abbr: 'ml', full: 'machine learning' },
  { abbr: 'dl', full: 'deep learning' },
  { abbr: 'api', full: 'application programming interface' },
  { abbr: 'dsa', full: 'data structures and algorithms' },
  { abbr: 'db', full: 'database' },
  { abbr: 'sql', full: 'structured query language' },
  { abbr: 'html', full: 'hypertext markup language' },
  { abbr: 'css', full: 'cascading style sheets' },
  { abbr: 'js', full: 'javascript' },
  { abbr: 'ui', full: 'user interface' },
  { abbr: 'ux', full: 'user experience' },
  { abbr: 'rag', full: 'retrieval augmented generation' },
  { abbr: 'faiss', full: 'facebook ai similarity search' },
  { abbr: 'http', full: 'hypertext transfer protocol' },
  { abbr: 'https', full: 'hypertext transfer protocol secure' },
  { abbr: 'url', full: 'uniform resource locator' },
  { abbr: 'cpu', full: 'central processing unit' },
  { abbr: 'gpu', full: 'graphics processing unit' },
  { abbr: 'ram', full: 'random access memory' },
  { abbr: 'rom', full: 'read only memory' },
  { abbr: 'iot', full: 'internet of things' },
  { abbr: 'nlp', full: 'natural language processing' },
  { abbr: 'cv', full: 'computer vision' },
  { abbr: 'llm', full: 'large language model' },
  { abbr: 'oop', full: 'object oriented programming' },
  { abbr: 'json', full: 'javascript object notation' },
  { abbr: 'rest', full: 'representational state transfer' }
];

const ABBR_TO_FULL = new Map();
const FULL_TO_ABBR = new Map();

ABBREVIATIONS.forEach(item => {
  const abbr = item.abbr.toLowerCase();
  const full = item.full.toLowerCase();
  const fullWords = full.split(/\s+/).filter(w => w.length > 0 && !STOPWORDS.has(w));

  ABBR_TO_FULL.set(abbr, fullWords);
  FULL_TO_ABBR.set(full, abbr);
});

const embeddingService = {
  VECTOR_DIM,

  /**
   * Tokenizes text and strips standard English stopwords.
   * Returns an array of significant word tokens (e.g. "what is TCP/IP?" -> ["tcp", "ip"]).
   */
  tokenize(text) {
    if (!text || typeof text !== 'string') return [];
    const cleanText = text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
    // Intentional: allow 2-letter technical acronyms like CN, IP, OS, AI, ML, DB, JS
    const rawTokens = cleanText.split(/\s+/).filter(t => t.length > 1);
    return rawTokens.filter(t => !STOPWORDS.has(t));
  },

  /**
   * Expands significant tokens bi-directionally using the technical abbreviations dictionary.
   * - Abbreviation -> Words in full phrase (e.g. "cn" -> ["cn", "computer", "network"]).
   * - Full phrase words -> Abbreviation (e.g. ["computer", "network"] -> ["computer", "network", "cn"]).
   */
  expandTokens(tokens, textQuery = '') {
    if (!Array.isArray(tokens)) tokens = [];
    const expandedSet = new Set(tokens);
    const textLower = (textQuery || '').toLowerCase();

    // 1. Abbreviation -> Full phrase tokens
    tokens.forEach(token => {
      const lower = token.toLowerCase();
      if (ABBR_TO_FULL.has(lower)) {
        const fullWords = ABBR_TO_FULL.get(lower);
        fullWords.forEach(w => expandedSet.add(w));
      }
    });

    // 2. Full phrase -> Abbreviation
    ABBREVIATIONS.forEach(item => {
      const fullPhrase = item.full.toLowerCase();
      const abbr = item.abbr.toLowerCase();

      if (textLower.includes(fullPhrase)) {
        expandedSet.add(abbr);
      } else {
        const fullWords = fullPhrase.split(/\s+/).filter(w => w.length > 0 && !STOPWORDS.has(w));
        const allPresent = fullWords.every(w => tokens.includes(w));
        if (allPresent && fullWords.length > 0) {
          expandedSet.add(abbr);
        }
      }
    });

    return Array.from(expandedSet);
  },

  /**
   * Generates dense vector embeddings for an array of text strings.
   * Uses stopword-filtered tokenization + deterministic hashing mapping to Float32Array of length VECTOR_DIM (512).
   */
  async generateEmbeddings(textArray) {
    if (!Array.isArray(textArray)) {
      textArray = [textArray];
    }
    return textArray.map(text => this.vectorizeText(text));
  },

  async generateEmbedding(text) {
    return this.vectorizeText(text);
  },

  vectorizeText(text) {
    const vec = new Float32Array(VECTOR_DIM);
    const baseTokens = this.tokenize(text);
    const significantTokens = this.expandTokens(baseTokens, text);

    if (significantTokens.length === 0) return Array.from(vec);

    // 1. Single word significant token hashing
    significantTokens.forEach((token) => {
      const hash = this.stringToHash(token);
      const index = Math.abs(hash) % VECTOR_DIM;
      vec[index] += 1.0;
    });

    // 2. Bigram features for significant token pairs
    for (let i = 0; i < significantTokens.length - 1; i++) {
      const bigram = significantTokens[i] + '_' + significantTokens[i + 1];
      const hash = this.stringToHash(bigram);
      const index = Math.abs(hash) % VECTOR_DIM;
      vec[index] += 1.5;
    }

    // 3. Normalize vector to unit length
    let norm = 0;
    for (let i = 0; i < VECTOR_DIM; i++) {
      norm += vec[i] * vec[i];
    }
    norm = Math.sqrt(norm);

    if (norm > 0) {
      for (let i = 0; i < VECTOR_DIM; i++) {
        vec[i] /= norm;
      }
    }

    return Array.from(vec);
  },

  stringToHash(str) {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) + hash) + str.charCodeAt(i);
    }
    return hash;
  }
};

module.exports = embeddingService;
