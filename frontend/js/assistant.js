/* KnowledgeAI AI Assistant JS Component - Session & Thread Scoped */

const chatSessionTurns = [];
let currentSession = null;
let currentThreadId = 'new';
let sessionThreadsList = [];

document.addEventListener('DOMContentLoaded', async () => {
  const token = checkAuth();
  if (!token) return;

  window.refreshActiveSessionGrid = async () => {
    await renderSessionGrid('sessionGridContainer', {
      onSelectSession: selectSessionChat,
      pageTitle: 'AI Assistant — Select Session',
      pageSubtitle: 'Select a subject collection to start a new chat thread or view past conversations.',
      allowCreate: false
    });
  };

  setupChatForm();

  // Check URL parameters ?session=ID&thread=ID&doc=ID&q=Query
  const urlParams = new URLSearchParams(window.location.search);
  const sessionIdParam = urlParams.get('session');
  const threadIdParam = urlParams.get('thread');
  const docIdParam = urlParams.get('doc');
  const queryParam = urlParams.get('q');

  if (sessionIdParam || threadIdParam || docIdParam || queryParam) {
    const sessions = await fetchSessions();
    let targetSession = null;

    if (sessionIdParam) {
      targetSession = sessions.find(s => String(s.id) === String(sessionIdParam));
    }
    
    if (!targetSession && threadIdParam) {
      try {
        const tRes = await fetch(`/api/threads/${threadIdParam}/messages`, { headers: getAuthHeader() });
        if (tRes.ok) {
          const tData = await tRes.json();
          if (tData.thread && tData.thread.session_id) {
            targetSession = sessions.find(s => String(s.id) === String(tData.thread.session_id));
          }
        }
      } catch (err) {}
    }

    if (!targetSession && docIdParam) {
      try {
        const dRes = await fetch(`/api/documents/${docIdParam}`, { headers: getAuthHeader() });
        if (dRes.ok) {
          const docData = await dRes.json();
          if (docData.session_id) {
            targetSession = sessions.find(s => String(s.id) === String(docData.session_id));
          }
        }
      } catch (err) {}
    }

    if (!targetSession && sessions.length > 0) {
      targetSession = sessions[0];
    }

    if (targetSession) {
      await selectSessionChat(targetSession, threadIdParam);
      if (queryParam) {
        const chatInput = document.getElementById('chatInput');
        if (chatInput) chatInput.value = queryParam;
      }
      return;
    }
  }

  // Default view: render Session Grid
  await window.refreshActiveSessionGrid();
});

async function selectSessionChat(session, targetThreadId = null) {
  currentSession = session;
  const gridContainer = document.getElementById('sessionGridContainer');
  const chatViewContainer = document.getElementById('sessionChatContainer');

  if (gridContainer) gridContainer.classList.add('hidden');
  if (chatViewContainer) chatViewContainer.classList.remove('hidden');

  // Update breadcrumb
  const iconEl = document.getElementById('chatBreadcrumbIcon');
  const nameEl = document.getElementById('chatBreadcrumbName');
  if (iconEl) iconEl.textContent = session.icon || '📁';
  if (nameEl) nameEl.textContent = session.name;

  await loadSessionThreads(session.id, targetThreadId);
}

function backToSessionsChat() {
  currentSession = null;
  currentThreadId = 'new';
  const gridContainer = document.getElementById('sessionGridContainer');
  const chatViewContainer = document.getElementById('sessionChatContainer');

  if (chatViewContainer) chatViewContainer.classList.add('hidden');
  if (gridContainer) gridContainer.classList.remove('hidden');

  if (typeof window.refreshActiveSessionGrid === 'function') {
    window.refreshActiveSessionGrid();
  }
}

async function loadSessionThreads(sessionId, targetThreadId = null) {
  try {
    const res = await fetch(`/api/sessions/${sessionId}/threads`, { headers: getAuthHeader() });
    if (!res.ok) throw new Error('Failed to load session threads');
    sessionThreadsList = await res.json();

    renderThreadsBar(sessionThreadsList);

    if (targetThreadId && sessionThreadsList.some(t => String(t.id) === String(targetThreadId))) {
      await loadThreadMessages(targetThreadId);
    } else if (sessionThreadsList.length > 0) {
      await loadThreadMessages(sessionThreadsList[0].id);
    } else {
      createNewThread();
    }
  } catch (err) {
    console.error('Error loading session threads:', err);
    createNewThread();
  }
}

function renderThreadsBar(threads) {
  const container = document.getElementById('threadsListContainer');
  if (!container) return;

  if (!threads || threads.length === 0) {
    container.innerHTML = `<span class="text-[#8C827A] italic text-[11px]">No saved threads yet</span>`;
    return;
  }

  container.innerHTML = threads.map(t => {
    const isSelected = String(t.id) === String(currentThreadId);
    const activeClasses = isSelected
      ? 'bg-[#7A2E38] text-[#FAF6EF] border-[#7A2E38] font-bold shadow-xs'
      : 'bg-white text-[#4A403A] border-[#E5DDD0] hover:border-[#9C7A3F] hover:bg-[#FAF6EF] font-medium';
    const title = escapeHtml(t.title || 'New Chat');

    return `
      <button onclick="loadThreadMessages(${t.id})" 
              class="px-3 py-1 rounded-full border text-xs transition-all flex items-center gap-1.5 shrink-0 max-w-[200px] truncate cursor-pointer ${activeClasses}"
              title="${title}">
        <span class="truncate">${title}</span>
      </button>
    `;
  }).join('');
}

function createNewThread() {
  currentThreadId = 'new';
  renderThreadsBar(sessionThreadsList);

  const container = document.getElementById('chatContainer');
  if (!container) return;

  const sessionName = currentSession ? escapeHtml(currentSession.name) : 'this subject';

  container.innerHTML = `
    <div class="flex items-start gap-3.5 mb-6">
      <div class="w-8 h-8 rounded-md bg-[#7A2E38] text-[#FAF6EF] font-serif font-bold text-sm flex items-center justify-center shrink-0 shadow-md mt-0.5" title="KnowledgeAI">
        K
      </div>
      <div class="kai-card p-6 bg-white border border-[#E5DDD0] text-[#221B17] text-xs sm:text-sm flex-1 w-full shadow-sm relative group pr-14 rounded-lg">
        <div class="flex items-center gap-2 mb-2">
          <h3 class="font-serif font-bold text-[#221B17] text-sm">${sessionName} Assistant</h3>
          <span class="text-[11px] font-mono text-[#8C827A]">• Threaded Session RAG + Grok AI</span>
        </div>
        <p class="text-xs sm:text-sm text-[#4A403A] leading-relaxed mb-4">
          Ask your first question about ${sessionName}! I will answer using context retrieved strictly from your ${sessionName} documents with exact citations and page figures.
        </p>
        <div class="flex flex-wrap gap-2">
          <button onclick="sendQuickPrompt('Summarize the main concepts in ${sessionName}.')" 
            class="text-xs bg-[#FAF6EF] hover:bg-[#FBF8F1] hover:text-[#9C7A3F] text-[#4A403A] px-3.5 py-2 rounded-md border border-[#E5DDD0] transition-colors inline-flex items-center gap-1.5">
            <svg class="w-3.5 h-3.5 stroke-[#9C7A3F] fill-none shrink-0" viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M15.09 14A6 6 0 0 0 18 9 6 6 0 0 0 6 9a6 6 0 0 0 2.91 5z"/></svg>
            <span>"Summarize the main concepts in ${sessionName}."</span>
          </button>
        </div>
      </div>
    </div>
  `;
}

async function loadThreadMessages(threadId) {
  currentThreadId = threadId;
  renderThreadsBar(sessionThreadsList);

  const container = document.getElementById('chatContainer');
  if (!container) return;

  container.innerHTML = '<div class="text-center text-xs text-[#8C827A] py-8">Loading chat history...</div>';

  try {
    const res = await fetch(`/api/threads/${threadId}/messages`, { headers: getAuthHeader() });
    if (!res.ok) throw new Error('Failed to load thread messages');

    const data = await res.json();
    const messages = data.messages || [];

    if (messages.length === 0) {
      createNewThread();
      return;
    }

    container.innerHTML = '';

    messages.forEach(msg => {
      if (msg.role === 'user') {
        appendUserMessage(msg.content, false);
      } else {
        appendAiMessage(msg.content, msg.sources || [], currentSession ? currentSession.id : null, msg.images || [], false);
      }
    });

    scrollToBottom();
  } catch (err) {
    console.error('Error loading thread messages:', err);
    container.innerHTML = '<div class="text-center text-xs text-[#8B2E28] py-8">Failed to load chat history for this thread.</div>';
  }
}

function setupChatForm() {
  const form = document.getElementById('chatForm');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = document.getElementById('chatInput');
    const sendBtn = document.getElementById('sendBtn');

    const message = input.value.trim();
    if (!message) return;

    if (!currentSession) {
      alert('Please select a session collection first.');
      return;
    }

    appendUserMessage(message);
    input.value = '';

    sendBtn.disabled = true;
    const loadingId = appendLoadingState();

    try {
      const endpoint = (currentThreadId && currentThreadId !== 'new')
        ? `/api/threads/${currentThreadId}/messages`
        : `/api/sessions/${currentSession.id}/threads`;

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          ...getAuthHeader(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          sessionId: currentSession.id,
          question: message
        })
      });

      removeLoadingState(loadingId);
      sendBtn.disabled = false;

      if (res.ok) {
        const data = await res.json();
        if (data.threadId) {
          currentThreadId = data.threadId;
        }

        // Refresh threads list in header
        const tRes = await fetch(`/api/sessions/${currentSession.id}/threads`, { headers: getAuthHeader() });
        if (tRes.ok) {
          sessionThreadsList = await tRes.json();
          renderThreadsBar(sessionThreadsList);
        }

        appendAiMessage(data.answer, data.citations || data.sources, currentSession.id, data.images);
      } else {
        const errData = await res.json().catch(() => ({}));
        appendAiMessage(errData.error || 'Apologies, an error occurred while processing your request.');
      }
    } catch (err) {
      removeLoadingState(loadingId);
      sendBtn.disabled = false;
      appendAiMessage('Network error: Unable to connect to KnowledgeAI backend service.');
    }
  });
}

function sendQuickPrompt(promptText) {
  const input = document.getElementById('chatInput');
  if (input) {
    input.value = promptText;
    document.getElementById('chatForm').dispatchEvent(new Event('submit'));
  }
}

function appendUserMessage(text, scroll = true) {
  const container = document.getElementById('chatContainer');
  if (!container) return;
  const msgDiv = document.createElement('div');
  msgDiv.className = 'flex items-start justify-end gap-3.5 mb-5';
  msgDiv.innerHTML = `
    <div class="bg-[#7A2E38] text-[#FAF6EF] px-5 py-3.5 rounded-lg rounded-tr-none max-w-4xl text-xs sm:text-sm leading-relaxed shadow-sm font-medium">
      ${escapeHtml(text)}
    </div>
    <div class="w-8 h-8 rounded-md bg-[#221B17] text-[#FAF6EF] font-serif font-bold text-xs flex items-center justify-center shrink-0 shadow-sm mt-0.5" title="User">
      U
    </div>
  `;
  container.appendChild(msgDiv);
  if (scroll) scrollToBottom();
}

function appendAiMessage(answer, citations = [], sessionId = null, images = [], scroll = true) {
  const container = document.getElementById('chatContainer');
  if (!container) return;

  const msgDiv = document.createElement('div');
  msgDiv.className = 'flex items-start gap-3.5 mb-6';

  const docIconSvg = `<svg class="w-3.5 h-3.5 stroke-current fill-none shrink-0" viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg>`;
  const starIconSvg = `<svg class="w-3.5 h-3.5 fill-current stroke-current shrink-0" viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></polygon></svg>`;

  let imagesHtml = '';
  if (images && images.length > 0) {
    imagesHtml = `
      <div class="mt-4 pt-3 border-t border-[#E5DDD0]">
        <div class="flex items-center gap-1.5 text-[11px] font-serif font-semibold text-[#8C827A] uppercase tracking-wider mb-2">
          <svg class="w-3.5 h-3.5 stroke-current fill-none" viewBox="0 0 24 24" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
          EXTRACTED DOCUMENT FIGURES & DIAGRAMS:
        </div>
        <div class="flex flex-wrap gap-3 items-center">
          ${images.map(img => {
            const cleanTitle = (img.documentName || 'Document').replace(/'/g, "\\'");
            return `
              <div onclick="openLightbox('${img.imageUrl}', '${cleanTitle}', ${img.page || 1})" 
                   class="group relative cursor-pointer overflow-hidden rounded-lg border border-[#9C7A3F]/30 bg-[#FAF6EF] p-1.5 shadow-xs hover:shadow-md transition-all hover:border-[#7A2E38] w-28 h-20 flex flex-col items-center justify-center">
                <img src="${img.imageUrl}" alt="Extracted Figure" class="max-h-12 max-w-full object-contain group-hover:scale-105 transition-transform" />
                <div class="mt-1 text-[10px] font-serif text-[#9C7A3F] font-semibold truncate w-full text-center px-1">
                  ${img.page ? `Page ${img.page}` : 'Figure'}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  let sourcesHtml = '';
  if (citations && citations.length > 0) {
    sourcesHtml = `
      <div class="mt-4 pt-3 border-t border-[#E5DDD0]">
        <div class="flex flex-wrap gap-2 items-center text-xs">
          <span class="text-[#8C827A] font-serif font-semibold text-[11px] mr-1">CITED SOURCES:</span>
          ${citations.map((c, i) => {
            const sourceNum = c.source_id || (i + 1);
            const docTitle = c.document_title || c.documentName || 'Document';
            const pageNum = c.page_number || c.page || 1;
            return `
              <div class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#9C7A3F]/10 text-[#9C7A3F] border border-[#9C7A3F]/20 text-xs font-serif font-semibold shadow-xs">
                ${docIconSvg}
                <span>[${sourceNum}] ${escapeHtml(docTitle)}</span>
                <span class="text-[10px] text-[#7C6132] font-mono">(Page ${pageNum})</span>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  const citationsAttr = escapeHtml(JSON.stringify(citations || []));
  const activeSessionId = sessionId || (currentSession ? currentSession.id : '');

  msgDiv.innerHTML = `
    <div class="w-8 h-8 rounded-md bg-[#7A2E38] text-[#FAF6EF] font-serif font-bold text-sm flex items-center justify-center shrink-0 shadow-md mt-0.5" title="KnowledgeAI">
      K
    </div>
    <div class="kai-card p-6 bg-white border border-[#E5DDD0] text-[#221B17] text-xs sm:text-sm flex-1 w-full markdown-body shadow-sm relative group pr-14 rounded-lg">
      <button onclick="toggleFavoriteMessage(this)" 
              data-citations="${citationsAttr}" 
              data-session-id="${activeSessionId}" 
              class="absolute top-3.5 right-3.5 btn-favorite text-xs z-10 hover:scale-105 transition-all inline-flex items-center gap-1 text-[#8C827A]" title="Save to Favorites">
        <span class="star-icon flex items-center justify-center shrink-0">${starIconSvg}</span>
        <span class="star-text hidden sm:inline">Favorite</span>
      </button>
      ${formatMarkdown(answer)}
      ${imagesHtml}
      ${sourcesHtml}
    </div>
  `;

  container.appendChild(msgDiv);
  if (scroll) scrollToBottom();
}

function appendLoadingState() {
  const container = document.getElementById('chatContainer');
  if (!container) return null;

  const id = `loading-${Date.now()}`;
  const loadingDiv = document.createElement('div');
  loadingDiv.id = id;
  loadingDiv.className = 'flex items-start gap-3.5 mb-6';
  loadingDiv.innerHTML = `
    <div class="w-8 h-8 rounded-md bg-[#7A2E38] text-[#FAF6EF] font-serif font-bold text-sm flex items-center justify-center shrink-0 shadow-md mt-0.5">
      K
    </div>
    <div class="kai-card p-5 bg-white border border-[#E5DDD0] text-[#221B17] text-xs sm:text-sm rounded-lg shadow-sm flex items-center gap-3">
      <div class="w-4 h-4 border-2 border-[#7A2E38] border-t-transparent rounded-full animate-spin"></div>
      <span class="text-xs text-[#8C827A] font-serif font-semibold">Retrieving session document context & synthesizing response...</span>
    </div>
  `;
  container.appendChild(loadingDiv);
  scrollToBottom();
  return id;
}

function removeLoadingState(id) {
  if (!id) return;
  const el = document.getElementById(id);
  if (el) el.remove();
}

function scrollToBottom() {
  const container = document.getElementById('chatContainer');
  if (container) {
    container.scrollTop = container.scrollHeight;
  }
}

function formatMarkdown(rawText) {
  if (!rawText) return '';
  let text = rawText.trim();

  // 1. Extract fenced code blocks (```lang ... ```)
  const codeBlocks = [];
  text = text.replace(/```([a-zA-Z0-9_-]*)\n?([\s\S]*?)```/g, (match, lang, codeContent) => {
    const placeholder = `___CODE_BLOCK_${codeBlocks.length}___`;
    const cleanCode = codeContent ? codeContent.trim() : '';
    const label = (lang && lang.trim()) ? lang.trim().toUpperCase() : 'DIAGRAM / CODE';
    const escapedCode = escapeHtml(cleanCode);
    const encodedCode = encodeURIComponent(cleanCode);

    const blockHtml = `<div class="relative group my-4 rounded-lg overflow-hidden border border-[#3A302A] bg-[#1E1815] shadow-md font-mono text-xs text-[#FAF6EF]">
  <div class="flex items-center justify-between px-3.5 py-1.5 bg-[#2A221E] border-b border-[#3A302A] text-[11px] font-sans">
    <span class="font-mono text-[10px] font-semibold tracking-wider text-[#C4B7A5]">${escapeHtml(label)}</span>
    <button onclick="copyCodeToClipboard(this)" data-code="${encodedCode}" class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-sans font-medium text-[#D9CEBF] hover:text-white bg-[#3A302A]/80 hover:bg-[#4A3E37] transition-all cursor-pointer shadow-xs">
      <svg class="w-3 h-3 fill-none stroke-current" viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
      <span>Copy</span>
    </button>
  </div>
  <pre class="p-4 overflow-x-auto text-xs leading-relaxed font-mono whitespace-pre text-[#F2ECE1] select-text"><code>${escapedCode}</code></pre>
</div>`;

    codeBlocks.push(blockHtml);
    return placeholder;
  });

  // 2. Inline code spans (`code`)
  const inlineCodes = [];
  text = text.replace(/`([^`]+)`/g, (match, codeContent) => {
    const placeholder = `___INLINE_CODE_${inlineCodes.length}___`;
    inlineCodes.push(`<code class="bg-[#FAF6EF] text-[#7A2E38] px-1.5 py-0.5 rounded font-mono text-xs border border-[#E5DDD0]">${escapeHtml(codeContent)}</code>`);
    return placeholder;
  });

  let safeText = escapeHtml(text);

  const lines = safeText.split('\n');
  let resultHtml = '';
  let inUl = false;
  let inOl = false;
  let inTable = false;
  let tableRows = [];

  function closeLists() {
    if (inUl) { resultHtml += '</ul>'; inUl = false; }
    if (inOl) { resultHtml += '</ol>'; inOl = false; }
  }

  function renderTable() {
    if (tableRows.length === 0) return;
    let tableHtml = `<div class="overflow-x-auto my-3"><table class="w-full text-xs text-left border-collapse border border-[#E5DDD0]">`;
    tableRows.forEach((row, idx) => {
      const cells = row.split('|').map(c => c.trim()).filter((c, i, a) => i > 0 && i < a.length - 1);
      if (idx === 0) {
        tableHtml += `<thead class="bg-[#FAF6EF] border-b border-[#E5DDD0] font-serif font-bold text-[#221B17]"><tr>`;
        cells.forEach(c => tableHtml += `<th class="px-3 py-2 border border-[#E5DDD0]">${parseInline(c)}</th>`);
        tableHtml += `</tr></thead><tbody>`;
      } else if (idx === 1 && row.includes('---')) {
        // Skip separator row
      } else {
        tableHtml += `<tr class="border-b border-[#E5DDD0] hover:bg-[#FAF6EF]/50">`;
        cells.forEach(c => tableHtml += `<td class="px-3 py-2 border border-[#E5DDD0]">${parseInline(c)}</td>`);
        tableHtml += `</tr>`;
      }
    });
    tableHtml += `</tbody></table></div>`;
    resultHtml += tableHtml;
    tableRows = [];
    inTable = false;
  }

  lines.forEach(line => {
    const trimmed = line.trim();

    if (!trimmed) {
      closeLists();
      if (inTable) renderTable();
      return;
    }

    if (trimmed.startsWith('___CODE_BLOCK_')) {
      closeLists();
      if (inTable) renderTable();
      resultHtml += trimmed;
      return;
    }

    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      closeLists();
      inTable = true;
      tableRows.push(trimmed);
      return;
    } else if (inTable) {
      renderTable();
    }

    if (/^##\s+(.*)/.test(trimmed)) {
      closeLists();
      const content = parseInline(trimmed.replace(/^##\s+/, ''));
      resultHtml += `<h2 class="text-base font-serif font-bold text-[#221B17] mt-4 mb-2 pb-1 border-b border-[#E5DDD0] flex items-center gap-1.5">${content}</h2>`;
      return;
    }

    if (/^#\s+(.*)/.test(trimmed)) {
      closeLists();
      const content = parseInline(trimmed.replace(/^#\s+/, ''));
      resultHtml += `<h1 class="text-lg font-serif font-bold text-[#221B17] mt-5 mb-2.5 pb-1 border-b border-[#E5DDD0]">${content}</h1>`;
      return;
    }

    if (/^[-*]\s+(.*)/.test(trimmed)) {
      if (inOl) closeLists();
      if (!inUl) { resultHtml += '<ul class="list-disc pl-5 my-2.5 space-y-1 text-[#4A403A] text-xs sm:text-sm">'; inUl = true; }
      const content = parseInline(trimmed.replace(/^[-*]\s+/, ''));
      resultHtml += `<li>${content}</li>`;
      return;
    }

    if (/^\d+\.\s+(.*)/.test(trimmed)) {
      if (inUl) closeLists();
      if (!inOl) { resultHtml += '<ol class="list-decimal pl-5 my-2.5 space-y-1 text-[#4A403A] text-xs sm:text-sm">'; inOl = true; }
      const content = parseInline(trimmed.replace(/^\d+\.\s+/, ''));
      resultHtml += `<li>${content}</li>`;
      return;
    }

    closeLists();
    const content = parseInline(trimmed);
    resultHtml += `<p class="mb-2.5 text-xs sm:text-sm leading-relaxed text-[#4A403A]">${content}</p>`;
  });

  closeLists();
  if (inTable) renderTable();

  resultHtml = resultHtml.replace(/\[(?:Source\s+)?(\d+)\]/g, '<span class="inline-flex items-center px-1.5 py-0.5 mx-0.5 rounded bg-[#9C7A3F]/10 text-[#9C7A3F] border border-[#9C7A3F]/20 text-xs font-serif font-bold">[$1]</span>');

  inlineCodes.forEach((html, i) => {
    resultHtml = resultHtml.replace(`___INLINE_CODE_${i}___`, html);
  });
  codeBlocks.forEach((html, i) => {
    resultHtml = resultHtml.replace(`___CODE_BLOCK_${i}___`, html);
  });

  return resultHtml;
}

function parseInline(alreadyEscapedText) {
  let res = alreadyEscapedText;
  res = res.replace(/\*\*([^*]+)\*\*/g, '<strong class="font-bold text-[#221B17]">$1</strong>');
  res = res.replace(/\*([^*]+)\*/g, '<em class="italic">$1</em>');
  return res;
}

async function toggleFavoriteMessage(btn, messageId = '', question = '', answer = '', citations = null, sessionId = null) {
  if (!btn) return;
  const isStarred = btn.classList.contains('starred');
  const starText = btn.querySelector('.star-text');

  if (isStarred) {
    const favId = btn.getAttribute('data-fav-id') || messageId;
    try {
      const res = await fetch(`/api/favorites/${favId}`, {
        method: 'DELETE',
        headers: getAuthHeader()
      });
      if (res.ok) {
        btn.classList.remove('starred', 'text-[#9C7A3F]');
        btn.classList.add('text-[#8C827A]');
        btn.removeAttribute('data-fav-id');
        if (starText) starText.textContent = 'Favorite';
      }
    } catch (e) {
      console.error('Error removing message favorite:', e);
    }
  } else {
    if (!answer) {
      const card = btn.closest('.kai-card');
      if (card) {
        const clone = card.cloneNode(true);
        const btnInClone = clone.querySelector('.btn-favorite');
        if (btnInClone) btnInClone.remove();
        answer = (clone.textContent || clone.innerText || '').trim();
      }
    }

    if (!citations && btn.dataset && btn.dataset.citations) {
      try {
        citations = JSON.parse(btn.dataset.citations);
      } catch (e) {
        citations = [];
      }
    }

    const sessId = sessionId || (btn.dataset ? btn.dataset.sessionId : null) || (currentSession ? currentSession.id : null);
    const titleVal = question || (btn.dataset ? btn.dataset.question : null) || (typeof currentSession !== 'undefined' && currentSession ? `${currentSession.name} QA` : 'AI Assistant Response');

    try {
      const res = await fetch('/api/favorites/message', {
        method: 'POST',
        headers: {
          ...getAuthHeader(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messageId: messageId || null,
          title: titleVal,
          content: answer || 'AI Response',
          citations: citations || [],
          sessionId: sessId || null
        })
      });

      const data = await res.json();
      if (res.ok) {
        btn.classList.add('starred', 'text-[#9C7A3F]');
        btn.classList.remove('text-[#8C827A]');
        if (data.favorite_id) btn.setAttribute('data-fav-id', data.favorite_id);
        if (starText) starText.textContent = 'Starred';
      }
    } catch (e) {
      console.error('Error adding message favorite:', e);
    }
  }
}

if (typeof window !== 'undefined') {
  window.toggleFavoriteMessage = toggleFavoriteMessage;
}


