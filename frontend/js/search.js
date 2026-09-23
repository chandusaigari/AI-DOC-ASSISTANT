/* KnowledgeAI Semantic Search JS - Session & Document Scoped */

document.addEventListener('DOMContentLoaded', async () => {
  const token = checkAuth();
  if (!token) return;

  await populateDocScope();
  setupSearch();

  const params = new URLSearchParams(window.location.search);
  const initialQuery = params.get('q');
  if (initialQuery) {
    const queryInput = document.getElementById('searchQuery');
    if (queryInput) {
      queryInput.value = initialQuery;
      document.getElementById('searchForm').dispatchEvent(new Event('submit'));
    }
  }
});

async function populateDocScope() {
  const select = document.getElementById('docScopeSelect');
  if (!select) return;

  select.innerHTML = '<option value="">Scope: All Documents</option>';

  try {
    const [sessRes, docRes] = await Promise.all([
      fetch('/api/sessions', { headers: getAuthHeader() }),
      fetch('/api/documents', { headers: getAuthHeader() })
    ]);

    if (sessRes.ok) {
      const sessions = await sessRes.json();
      if (sessions && sessions.length > 0) {
        const sessGroup = document.createElement('optgroup');
        sessGroup.label = '── SUBJECT SESSIONS ──';
        sessions.forEach(sess => {
          const opt = document.createElement('option');
          opt.value = `session:${sess.id}`;
          opt.textContent = `${sess.icon || '📁'} Session: ${sess.name} (${sess.document_count || 0} docs)`;
          sessGroup.appendChild(opt);
        });
        select.appendChild(sessGroup);
      }
    }

    if (docRes.ok) {
      const docs = await docRes.json();
      if (docs && docs.length > 0) {
        const docGroup = document.createElement('optgroup');
        docGroup.label = '── INDIVIDUAL DOCUMENTS ──';
        docs.forEach(doc => {
          const opt = document.createElement('option');
          opt.value = `doc:${doc.id}`;
          opt.textContent = `${doc.title}`;
          docGroup.appendChild(opt);
        });
        select.appendChild(docGroup);
      }
    }
  } catch (err) {
    console.error('Failed to populate document scope dropdown:', err);
  }
}

function setupSearch() {
  const form = document.getElementById('searchForm');
  const queryInput = document.getElementById('searchQuery');
  const scopeSelect = document.getElementById('docScopeSelect');
  const submitBtn = document.getElementById('searchSubmitBtn');
  const resultsList = document.getElementById('searchResultsList');
  const resultsHeader = document.getElementById('resultsHeader');
  const matchCount = document.getElementById('matchCount');

  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const query = queryInput.value.trim();
    if (!query) return;

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span>Searching...</span>';
    resultsList.innerHTML = `
      <div class="kai-card p-12 text-center text-[#8C827A] rounded-lg border border-[#E5DDD0]">
        <p class="text-xs font-serif font-semibold animate-pulse">Running FAISS vector search over document embeddings...</p>
      </div>
    `;

    const scopeVal = scopeSelect ? scopeSelect.value : '';
    let sessionId = null;
    let documentId = null;

    if (scopeVal.startsWith('session:')) {
      sessionId = scopeVal.replace('session:', '');
    } else if (scopeVal.startsWith('doc:')) {
      documentId = scopeVal.replace('doc:', '');
    } else if (scopeVal) {
      documentId = scopeVal;
    }

    try {
      const payload = { query };
      if (sessionId) payload.sessionId = sessionId;
      if (documentId) payload.documentId = documentId;

      const res = await fetch('/api/search', {
        method: 'POST',
        headers: {
          ...getAuthHeader(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<span>Search Vector Index &rarr;</span>';

      if (res.ok) {
        const results = data.results || [];
        if (resultsHeader) resultsHeader.classList.remove('hidden');
        if (matchCount) matchCount.textContent = results.length;

        if (results.length === 0) {
          resultsList.innerHTML = `
            <div class="kai-card p-12 text-center text-[#8C827A] bg-white border border-[#E5DDD0] rounded-lg">
              <p class="text-sm font-serif font-semibold text-[#221B17]">No semantic vector matches found in this scope.</p>
              <p class="text-xs text-[#8C827A] mt-1">Try broadening your search query or selecting "Scope: All Documents".</p>
            </div>
          `;
          return;
        }

        renderSearchResults(results);
      } else {
        alert(data.error || 'Search failed.');
      }
    } catch (err) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<span>Search Vector Index &rarr;</span>';
      resultsList.innerHTML = `
        <div class="kai-card p-12 text-center text-[#8B2E28] bg-white border border-red-200 rounded-lg">
          <p class="text-sm font-serif font-semibold">Network error during vector search execution.</p>
        </div>
      `;
    }
  });
}

function renderSearchResults(results) {
  const resultsList = document.getElementById('searchResultsList');
  const docIconSvg = `<svg class="w-4 h-4 stroke-[#9C7A3F] fill-none shrink-0" viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg>`;

  resultsList.innerHTML = results.map(item => {
    const relevance = item.relevancePercentage || Math.round((item.score || 0.8) * 100);

    let imagesMarkup = '';
    if (item.images && item.images.length > 0) {
      imagesMarkup = `
        <div class="mt-3 pt-3 border-t border-[#E5DDD0]">
          <div class="flex items-center gap-1.5 text-[11px] font-serif font-semibold text-[#8C827A] uppercase tracking-wider mb-2">
            <svg class="w-3.5 h-3.5 stroke-current fill-none" viewBox="0 0 24 24" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
            EXTRACTED PAGE FIGURES:
          </div>
          <div class="flex flex-wrap gap-3 items-center">
            ${item.images.map(img => {
              const cleanTitle = (img.documentName || item.document_title || 'Document').replace(/'/g, "\\'");
              return `
                <div onclick="openLightbox('${img.imageUrl}', '${cleanTitle}', ${img.page || item.page_number || 1})" 
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

    return `
      <div class="kai-card p-6 bg-white border border-[#E5DDD0] rounded-lg shadow-xs hover:shadow-md transition-all">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
          <div class="flex items-center gap-2">
            ${docIconSvg}
            <h4 class="font-serif font-bold text-[#1C1613] text-sm sm:text-base">${escapeHtml(item.document_title || 'Document')}</h4>
            <span class="text-xs font-mono text-[#8C827A]">(Page ${item.page_number || 1})</span>
          </div>
          <span class="px-2.5 py-1 rounded bg-[#9C7A3F]/10 text-[#9C7A3F] border border-[#9C7A3F]/20 text-xs font-serif font-bold self-start sm:self-auto">
            ${relevance}% Similarity Match
          </span>
        </div>

        <p class="text-xs sm:text-sm text-[#4A403A] leading-relaxed mb-4 whitespace-pre-wrap">${escapeHtml(item.content)}</p>

        ${imagesMarkup}

        <div class="mt-4 pt-3 border-t border-[#E5DDD0] flex justify-between items-center text-xs">
          <span class="text-[#8C827A] font-mono text-[11px]">Section: ${escapeHtml(item.section_title || 'General')}</span>
          <div class="flex items-center gap-3">
            <button onclick="toggleFavoriteDocument(${item.document_id}, false, () => alert('PDF document added to Favorites!'))" class="text-xs text-[#9C7A3F] hover:text-[#7C6132] font-serif font-bold inline-flex items-center gap-1 cursor-pointer" title="Add PDF to Favorites">
              <span>★ Favorite PDF</span>
            </button>
            <a href="assistant.html?doc=${item.document_id}" class="text-[#7A2E38] hover:text-[#5A2129] font-serif font-semibold inline-flex items-center gap-1">
              <span>Ask AI Assistant &rarr;</span>
            </a>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
