const https = require('https');
require('dotenv').config();

const grokService = {
  stripRawMarkdown(text) {
    if (!text) return '';
    return text
      .replace(/^#{1,6}\s+/gm, '')
      .replace(/^>\s+/gm, '')
      .replace(/```[\s\S]*?```/g, '')
      .replace(/[`*_\\]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  },

  async askQuestion({ question, contextChunks, conversationHistory = [], userApiKey, isFallbackContext = false }) {
    const apiKey = (userApiKey && userApiKey.trim().length > 5) ? userApiKey.trim() : (process.env.GROK_API_KEY || '').trim();

    // Clean chunks
    const cleanedChunks = (contextChunks || []).map(c => ({
      ...c,
      cleanContent: this.stripRawMarkdown(c.content)
    }));

    const finalCitations = isFallbackContext ? [] : this.buildCitations(cleanedChunks);

    // Rule 1: NEVER format & display raw passages as an answer.
    // If API key is missing or unconfigured, throw a clear error.
    if (!apiKey || apiKey.length <= 5) {
      throw new Error(
        "AI Assistant isn't configured (GROK_API_KEY is missing). " +
        "Please add your Grok or Groq API key in Settings or set GROK_API_KEY in your server environment."
      );
    }

    // Construct context string for API
    const contextFormatted = cleanedChunks.map((c, i) => {
      return `[Source ${i + 1}] Document: "${c.document_title || c.original_filename}" | Section: ${c.section_title || 'General'} | Page: ${c.page_number}\nPassage: "${c.cleanContent}"`;
    }).join('\n\n');

    let systemPrompt = `You are KnowledgeAI, an expert AI document assistant. Format your answer using ONLY plain Markdown syntax — headers (#), bold (**text**), bullet/numbered lists, and fenced code blocks (\`\`\`) for code snippets and ASCII box diagrams.

NEVER output raw HTML tags, <code> elements, class attributes, Tailwind utility classes, inline style attributes, or hex color codes anywhere in your answer — all visual styling is applied by the frontend renderer, not by you.

CRITICAL RULES FOR DIAGRAMS & VISUAL STRUCTURES:
1. MANDATORY ASCII BOX DIAGRAM: Whenever the user question asks for a diagram, visual, architecture, stack, flow, or hierarchy (such as the OSI model, network stack, system architecture, etc.), you MUST draw a clean, well-aligned ASCII box-drawing diagram enclosed in a fenced code block (\`\`\`text ... \`\`\`).
Example format:
\`\`\`text
┌───────────────────────────────────────────────────────────┐
│                 7. APPLICATION LAYER                      │
│            (HTTP, FTP, SMTP, DNS, SSH)                    │
├───────────────────────────────────────────────────────────┤
│                6. PRESENTATION LAYER                      │
│            (SSL/TLS, JPEG, ASCII, MIME)                   │
├───────────────────────────────────────────────────────────┤
│                  5. SESSION LAYER                         │
│            (RPC, NetBIOS, Sockets)                        │
├───────────────────────────────────────────────────────────┤
│                 4. TRANSPORT LAYER                        │
│               (TCP, UDP, Port Numbers)                    │
├───────────────────────────────────────────────────────────┤
│                  3. NETWORK LAYER                         │
│            (IP, ICMP, ARP, Routers)                       │
├───────────────────────────────────────────────────────────┤
│                 2. DATA LINK LAYER                        │
│          (Ethernet, Switches, MAC Addresses)              │
├───────────────────────────────────────────────────────────┤
│                 1. PHYSICAL LAYER                         │
│           (Cables, Hubs, NICs, Signal Bits)               │
└───────────────────────────────────────────────────────────┘
\`\`\`

2. NEVER DISCLAIM OR REFUSE TO DRAW: You must NEVER state "I cannot display an image", "I can't embed an actual diagram", "I'm not able to draw", "I cannot provide a visual diagram", "adhering to the rule against generating ASCII art", or any similar refusal. The ASCII box-drawing diagram inside the code block IS the diagram.
3. COMBINE TEXT & DIAGRAM: Provide your direct text explanation alongside the ASCII box-drawing diagram code block.

FORMATTING & SYNTHESIS RULES:
1. SYNTHESIZE IN YOUR OWN WORDS: Write one direct, well-synthesized response explaining the topic in your own clear words based on the provided document context passages. Organize multi-part or detailed answers cleanly with bold lead-ins, ## sub-headings, bullet points, or numbered steps. Never echo raw passages back as a labeled list or copy raw paragraph headers like "Relevant Passage [N]".
2. COMPACT INLINE CITATIONS: Include inline citation markers like [1], [2] at the end of sentences that rely on facts from source [1] or [2].
3. UNRELATED TOPICS: If the provided document context passages have nothing to do with the user's question, reply with: "I couldn't find information about that in your uploaded documents."`;

    if (isFallbackContext) {
      systemPrompt = `You are KnowledgeAI, an expert AI document assistant.
IMPORTANT: The user asked a question scoped to a specific document, but targeted search found no direct matches for their question in that document.
Provided below are the opening passages of the selected document for fallback reference.

INSTRUCTIONS:
1. Read the fallback passages. If they happen to actually answer the user's question, answer it clearly in 2-3 sentences in your own words.
2. Otherwise, state plainly in one sentence: "I couldn't find information about '${question}' in this document."
3. Briefly summarize in 2 sentences what this specific document covers instead.
4. CRITICAL: DO NOT include any citation markers (such as [1], [2]) anywhere in your response, as these fallback passages were not exact search matches to the question.`;
    }

    const isVisualQuery = /\b(?:diagram|diagrams|picture|pictures|image|images|figure|figures|chart|charts|graph|graphs|illustration|illustrations|show|shows|showing|visual|visuals|screenshot|screenshots|draw|drawing|photo|photos|map|maps|flowchart|architecture)\b/i.test(question);

    const userPrompt = `DOCUMENT CONTEXT:
${contextFormatted}

USER QUESTION:
${question}

Instructions: Answer the user's question in your own synthesized words following all rules. ${isVisualQuery ? 'IMPORTANT: You MUST include a clean ASCII box-drawing diagram in a fenced code block ```text ... ``` showing the layers or architecture.' : ''} ${isFallbackContext ? 'DO NOT include citation markers.' : 'Include compact inline citation markers like [1], [2].'}`;

    try {
      let aiAnswer = await this.callGrokApi(apiKey, systemPrompt, userPrompt, conversationHistory);
      if (aiAnswer) {
        aiAnswer = aiAnswer
          .replace(/【(\d+)】/g, '[$1]')
          .replace(/\[Source\s+(\d+)\]/gi, '[$1]')
          .replace(/(?:note:?\s*)?I\s*(?:can['’]t|cannot|am unable to|am not able to)\s*(?:embed|display|show|draw|provide|create)\s*(?:an?\s*)?(?:actual|visual|real)?\s*(?:diagram|image|picture|figure)[^.\n]*[.\n]?/gi, '')
          .replace(/(?:while\s+)?complying\s+with\s+(?:the\s+rule|rules)\s+against[^\.\n]*[\.\n]?/gi, '')
          .replace(/(?:while\s+)?adhering\s+to\s+(?:the\s+rule|rules)\s+against[^\.\n]*[\.\n]?/gi, '')
          .trim()
          .replace(/^(?:,\s*|\s*)but\s+/i, '')
          .trim();

        if (aiAnswer.length > 0) {
          aiAnswer = aiAnswer.charAt(0).toUpperCase() + aiAnswer.slice(1);
        }
      }
      return {
        answer: aiAnswer,
        citations: finalCitations,
        engine: 'grok-api'
      };
    } catch (err) {
      console.error('[RAG Synthesis Error]:', err.message);
      throw new Error(`AI Assistant service error: ${err.message}`);
    }
  },

  buildCitations(contextChunks) {
    return contextChunks.map((c, i) => {
      const text = c.cleanContent || this.stripRawMarkdown(c.content || '');
      const snippet = text.length > 120 ? text.substring(0, 120) + '...' : text;
      return {
        source_id: i + 1,
        document_id: c.document_id,
        document_title: c.document_title || c.original_filename || 'Uploaded Document',
        section_title: c.section_title || `Page ${c.page_number || 1}`,
        page_number: c.page_number || 1,
        snippet
      };
    });
  },

  async callGrokApi(apiKey, systemPrompt, userPrompt, conversationHistory = []) {
    const isGroq = apiKey.startsWith('gsk_');
    const hostname = isGroq ? 'api.groq.com' : 'api.x.ai';
    const path = isGroq ? '/openai/v1/chat/completions' : '/v1/chat/completions';

    // Model candidate list with automatic fallback
    let candidateModels = [];
    if (process.env.GROK_MODEL && process.env.GROK_MODEL.trim()) {
      candidateModels.push(process.env.GROK_MODEL.trim());
    }

    if (isGroq) {
      candidateModels.push('openai/gpt-oss-120b', 'openai/gpt-oss-20b', 'qwen/qwen3.8-27b');
    } else {
      candidateModels.push('grok-beta', 'grok-2-latest', 'grok-2-vision-1212');
    }

    // Deduplicate candidate models
    candidateModels = [...new Set(candidateModels)];

    let lastError = null;

    for (const modelName of candidateModels) {
      try {
        console.log(`[Grok API] Attempting completion using model '${modelName}' on host '${hostname}'...`);
        const result = await this.makeHttpRequest({
          apiKey,
          hostname,
          path,
          modelName,
          systemPrompt,
          userPrompt,
          conversationHistory
        });
        return result;
      } catch (err) {
        console.warn(`[Grok API Model Warning] Model '${modelName}' failed: ${err.message}. Trying next candidate model...`);
        lastError = err;
      }
    }

    throw lastError || new Error('All LLM model candidates failed to complete the request.');
  },

  makeHttpRequest({ apiKey, hostname, path, modelName, systemPrompt, userPrompt, conversationHistory }) {
    return new Promise((resolve, reject) => {
      const messages = [{ role: 'system', content: systemPrompt }];

      if (Array.isArray(conversationHistory) && conversationHistory.length > 0) {
        const recentTurns = conversationHistory.slice(-6);
        for (const turn of recentTurns) {
          if (turn.role && turn.content) {
            messages.push({ role: turn.role === 'user' ? 'user' : 'assistant', content: turn.content });
          } else if (turn.question || turn.answer || turn.answerText) {
            if (turn.question) messages.push({ role: 'user', content: turn.question });
            if (turn.answer || turn.answerText) messages.push({ role: 'assistant', content: turn.answer || turn.answerText });
          }
        }
      }

      messages.push({ role: 'user', content: userPrompt });

      const postData = JSON.stringify({
        model: modelName,
        messages: messages,
        temperature: 0.2,
        max_tokens: 1200
      });

      const options = {
        hostname: hostname,
        port: 443,
        path: path,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'Content-Length': Buffer.byteLength(postData)
        }
      };

      const req = https.request(options, (res) => {
        let body = '';
        res.on('data', (chunk) => body += chunk);
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try {
              const parsed = JSON.parse(body);
              const content = parsed.choices[0]?.message?.content;
              if (content && content.trim()) {
                resolve(content.trim());
              } else {
                reject(new Error('Empty completion response from LLM API.'));
              }
            } catch (e) {
              reject(new Error('Failed to parse API response JSON.'));
            }
          } else {
            reject(new Error(`API returned HTTP ${res.statusCode}: ${body}`));
          }
        });
      });

      req.on('error', (e) => reject(e));
      req.write(postData);
      req.end();
    });
  }
};

module.exports = grokService;
