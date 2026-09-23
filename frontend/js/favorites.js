/* KnowledgeAI Favorites JS - Private Bank & Law Firm Editorial Theme */

let allFavoritesList = [];
let currentFavFilter = 'all';

document.addEventListener('DOMContentLoaded', async () => {
  const token = checkAuth();
  if (!token) return;

  await loadFavorites();
});

async function loadFavorites() {
  const grid = document.getElementById('favGrid');
  const countEl = document.getElementById('favCount');

  try {
    const res = await fetch('/api/favorites', { headers: getAuthHeader() });
    if (!res.ok) throw new Error('Failed to load favorites');
    allFavoritesList = await res.json();

    renderFavoritesList();
  } catch (err) {
    console.error('Error loading favorites:', err);
    if (grid) grid.innerHTML = `<div class="col-span-full py-6 text-center text-[#8B2E28] text-xs">Error loading favorites.</div>`;
  }
}

function filterFavorites(type) {
  currentFavFilter = type;

  // Update tab styles
  const tabs = ['all', 'document', 'message'];
  tabs.forEach(t => {
    const btn = document.getElementById(`tab-${t}`);
    if (btn) {
      if (t === type) {
        btn.className = 'fav-tab px-3 py-1 rounded-md transition-all bg-[#7A2E38] text-[#FAF6EF] shadow-xs cursor-pointer';
      } else {
        btn.className = 'fav-tab px-3 py-1 rounded-md transition-all text-[#4A403A] hover:bg-white/60 cursor-pointer';
      }
    }
  });

  renderFavoritesList();
}

function renderFavoritesList() {
  const grid = document.getElementById('favGrid');
  const countEl = document.getElementById('favCount');
  if (!grid) return;

  let filtered = allFavoritesList;
  if (currentFavFilter === 'document') {
    filtered = allFavoritesList.filter(f => f.item_type === 'document');
  } else if (currentFavFilter === 'message') {
    filtered = allFavoritesList.filter(f => f.item_type === 'message');
  }

  if (countEl) countEl.textContent = `${filtered.length} item${filtered.length === 1 ? '' : 's'}`;

  const starIconSvg = `<svg class="w-8 h-8 fill-current stroke-current text-[#9C7A3F] shrink-0" viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></polygon></svg>`;
  const pdfSvg = `<svg class="w-5 h-5 stroke-[#7A2E38] fill-none shrink-0" viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><text x="7" y="18" font-size="7" font-family="serif" font-weight="bold" fill="#7A2E38" stroke="none">PDF</text></svg>`;
  const docxSvg = `<svg class="w-5 h-5 stroke-[#9C7A3F] fill-none shrink-0" viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><text x="6.5" y="18" font-size="6.5" font-family="serif" font-weight="bold" fill="#9C7A3F" stroke="none">DOC</text></svg>`;
  const robotSvg = `<svg class="w-5 h-5 stroke-[#7A2E38] fill-none shrink-0" viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="10" rx="3"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4"/><line x1="8" y1="15" x2="8" y2="15.01"/><line x1="16" y1="15" x2="16" y2="15.01"/><line x1="9" y1="18" x2="15" y2="18"/></svg>`;

  if (!filtered || filtered.length === 0) {
    grid.innerHTML = `
      <div class="col-span-full py-12 text-center text-[#8C827A] text-sm bg-white rounded-lg border border-[#E5DDD0] p-8 shadow-sm">
        <div class="w-12 h-12 mx-auto mb-3 flex items-center justify-center">
          ${starIconSvg}
        </div>
        <p class="font-serif font-semibold text-[#221B17] text-base">No ${currentFavFilter === 'all' ? 'favorites' : currentFavFilter === 'document' ? 'favorited PDF documents' : 'favorited AI answers'} saved yet</p>
        <p class="text-xs text-[#8C827A] mt-1">Star documents in your library or click Favorite on AI responses in Assistant chat to pin them here.</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = filtered.map(item => {
    const favId = item.favorite_id || item.id;

    if (item.item_type === 'message') {
      const titleText = escapeHtml(item.title || 'AI Assistant Bookmark');
      const rawContent = item.content || '';
      const snippet = escapeHtml(cleanPreviewSnippet(rawContent));
      const citations = item.citations || [];

      // Determine best link target: session ID or first cited document ID
      let targetUrl = 'assistant.html';
      if (item.session_id) {
        targetUrl = `assistant.html?session=${item.session_id}`;
      } else if (citations.length > 0 && (citations[0].document_id || citations[0].documentId)) {
        targetUrl = `assistant.html?doc=${citations[0].document_id || citations[0].documentId}`;
      }

      return `
        <div class="kai-card p-6 border-t-4 border-t-[#7A2E38] hover:shadow-md transition-all flex flex-col justify-between bg-white border border-[#E5DDD0] rounded-lg">
          <div>
            <div class="flex items-center justify-between mb-3">
              <span class="shrink-0 flex items-center justify-center">${robotSvg}</span>
              <span class="text-xs bg-[#7A2E38]/10 text-[#7A2E38] font-serif font-bold px-2 py-0.5 rounded border border-[#7A2E38]/20">🤖 AI Answer</span>
            </div>
            <h4 class="font-serif font-bold text-[#221B17] text-sm mb-2 line-clamp-2" title="${titleText}">${titleText}</h4>
            <p class="text-xs text-[#4A403A] leading-relaxed mb-4 line-clamp-4 bg-[#FAF6EF] p-2.5 rounded border border-[#E5DDD0]/60">${snippet}</p>
            ${citations.length > 0 ? `
              <div class="text-[10px] text-[#9C7A3F] font-serif font-semibold mb-3 flex flex-wrap items-center gap-1.5">
                <span class="text-[#8C827A]">Sources:</span>
                ${citations.map(c => {
                  const docId = c.document_id || c.documentId || '';
                  const docTitle = escapeHtml(c.document_title || c.documentName || 'PDF Document');
                  if (docId) {
                    return `<a href="assistant.html?doc=${docId}" class="bg-[#9C7A3F]/10 hover:bg-[#9C7A3F]/20 text-[#9C7A3F] px-1.5 py-0.5 rounded border border-[#9C7A3F]/20 transition-colors inline-flex items-center gap-1">${docTitle}</a>`;
                  }
                  return `<span class="bg-[#9C7A3F]/10 text-[#9C7A3F] px-1.5 py-0.5 rounded border border-[#9C7A3F]/20">${docTitle}</span>`;
                }).join('')}
              </div>
            ` : ''}
          </div>
          <div class="pt-4 border-t border-[#E5DDD0] flex items-center justify-between gap-2">
            <a href="${targetUrl}" class="btn-primary text-xs py-1.5 px-3 bg-[#7A2E38] hover:bg-[#5A2129] inline-flex items-center gap-1.5">
              <span>Open Assistant &rarr;</span>
            </a>
            <button onclick="removeFavorite(${favId})" class="btn-secondary text-xs text-[#8B2E28] border-[#F5D5D3] hover:bg-[#FDF2F1] py-1.5 px-3 cursor-pointer">
              Remove
            </button>
          </div>
        </div>
      `;
    } else {
      const docId = item.document_id || item.id;
      const fileType = (item.file_type || 'pdf').toLowerCase();
      const docTitle = escapeHtml(item.title || 'Untitled Document');
      const targetUrl = item.session_id ? `assistant.html?session=${item.session_id}&doc=${docId}` : `assistant.html?doc=${docId}`;

      return `
        <div class="kai-card p-6 border-t-4 border-t-[#9C7A3F] hover:shadow-md transition-all flex flex-col justify-between bg-white border border-[#E5DDD0] rounded-lg">
          <div>
            <div class="flex items-center justify-between mb-3">
              <span class="shrink-0 flex items-center justify-center">${fileType === 'pdf' ? pdfSvg : docxSvg}</span>
              <span class="text-xs bg-[#9C7A3F]/10 text-[#9C7A3F] font-serif font-bold px-2 py-0.5 rounded border border-[#9C7A3F]/20">★ PDF Document</span>
            </div>
            <h4 class="font-serif font-bold text-[#221B17] text-sm mb-1 line-clamp-2" title="${docTitle}">${docTitle}</h4>
            <p class="text-xs text-[#8C827A] font-mono mb-4">${fileType.toUpperCase()} • ${item.total_pages || 1} Pages • ${item.total_chunks || 0} Chunks</p>
          </div>
          <div class="pt-4 border-t border-[#E5DDD0] flex items-center justify-between gap-2">
            <a href="${targetUrl}" class="btn-primary text-xs py-1.5 px-3 bg-[#7A2E38] hover:bg-[#5A2129] inline-flex items-center gap-1.5">
              <span>Ask Assistant &rarr;</span>
            </a>
            <button onclick="removeFavorite(${favId})" class="btn-secondary text-xs text-[#8B2E28] border-[#F5D5D3] hover:bg-[#FDF2F1] py-1.5 px-3 cursor-pointer">
              Remove
            </button>
          </div>
        </div>
      `;
    }
  }).join('');
}

function cleanPreviewSnippet(text) {
  if (!text) return '';
  return text
    .replace(/```[\s\S]*?```/g, '[code snippet]')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/^#+\s+/gm, '')
    .replace(/\[\d+\]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function removeFavorite(favId) {
  try {
    const res = await fetch(`/api/favorites/${favId}`, {
      method: 'DELETE',
      headers: getAuthHeader()
    });
    if (res.ok) {
      allFavoritesList = allFavoritesList.filter(f => (f.favorite_id || f.id) !== favId);
      renderFavoritesList();
    } else {
      alert('Failed to remove favorite.');
    }
  } catch (err) {
    alert('Failed to remove favorite.');
  }
}

if (typeof window !== 'undefined') {
  window.loadFavorites = loadFavorites;
  window.filterFavorites = filterFavorites;
  window.removeFavorite = removeFavorite;
}
