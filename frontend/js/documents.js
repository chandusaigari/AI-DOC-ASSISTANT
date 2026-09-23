/* KnowledgeAI Documents Manager JS - Session Scoped */

let currentDocuments = [];
let currentSession = null;

document.addEventListener('DOMContentLoaded', async () => {
  const token = checkAuth();
  if (!token) return;

  window.refreshActiveSessionGrid = async () => {
    await renderSessionGrid('sessionGridContainer', {
      onSelectSession: selectSession,
      pageTitle: 'Document Collections',
      pageSubtitle: 'Select a subject collection to view files and upload new documents.',
      allowCreate: true
    });
  };

  setupUploadForm();

  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => filterDocuments(e.target.value));
  }

  // Check URL parameter ?session=ID
  const urlParams = new URLSearchParams(window.location.search);
  const sessionIdParam = urlParams.get('session');

  if (sessionIdParam) {
    const sessions = await fetchSessions();
    const targetSession = sessions.find(s => String(s.id) === String(sessionIdParam));
    if (targetSession) {
      selectSession(targetSession);
      return;
    }
  }

  // Default view: render Session Grid
  await window.refreshActiveSessionGrid();
});

async function selectSession(session) {
  currentSession = session;
  const gridContainer = document.getElementById('sessionGridContainer');
  const detailContainer = document.getElementById('sessionDetailContainer');

  if (gridContainer) gridContainer.classList.add('hidden');
  if (detailContainer) detailContainer.classList.remove('hidden');

  // Update breadcrumbs and titles
  const breadcrumbIcon = document.getElementById('sessionBreadcrumbIcon');
  const breadcrumbName = document.getElementById('sessionBreadcrumbName');
  const uploadSessionName = document.getElementById('uploadSessionName');
  const tableSessionName = document.getElementById('tableSessionName');

  if (breadcrumbIcon) breadcrumbIcon.textContent = session.icon || '📁';
  if (breadcrumbName) breadcrumbName.textContent = session.name;
  if (uploadSessionName) uploadSessionName.textContent = session.name;
  if (tableSessionName) tableSessionName.textContent = session.name;

  await loadSessionDocuments(session.id);
}

function backToSessions() {
  currentSession = null;
  const gridContainer = document.getElementById('sessionGridContainer');
  const detailContainer = document.getElementById('sessionDetailContainer');

  if (detailContainer) detailContainer.classList.add('hidden');
  if (gridContainer) gridContainer.classList.remove('hidden');

  if (typeof window.refreshActiveSessionGrid === 'function') {
    window.refreshActiveSessionGrid();
  }
}

async function loadSessionDocuments(sessionId) {
  const tbody = document.getElementById('docsTableBody');
  if (!tbody) return;

  try {
    const res = await fetch(`/api/sessions/${sessionId}/documents`, { headers: getAuthHeader() });
    if (!res.ok) throw new Error('Failed to load session documents');
    currentDocuments = await res.json();
    renderDocumentsTable(currentDocuments);
  } catch (err) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="py-6 text-center text-[#8B2E28] text-xs">
          Failed to load documents for this session.
        </td>
      </tr>
    `;
  }
}

let pollTimer = null;

function renderDocumentsTable(docs) {
  const tbody = document.getElementById('docsTableBody');
  const sessionName = currentSession ? currentSession.name : 'this session';

  if (!docs || docs.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="py-12 text-center text-[#8C827A] text-sm">
          <div class="space-y-2">
            <div class="w-10 h-10 mx-auto mb-2 text-[#9C7A3F] flex items-center justify-center">
              <svg class="w-8 h-8 stroke-current fill-none" viewBox="0 0 24 24" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg>
            </div>
            <p class="font-serif font-semibold text-[#221B17] text-sm">Upload your first ${escapeHtml(sessionName)} document to get started</p>
            <p class="text-xs text-[#8C827A]">Supported formats: PDF (.pdf) and Word (.docx)</p>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  const hasProcessing = docs.some(d => d.status === 'processing');
  if (hasProcessing && !pollTimer && currentSession) {
    pollTimer = setInterval(() => loadSessionDocuments(currentSession.id), 2500);
  } else if (!hasProcessing && pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }

  const pdfSvg = `<svg class="w-5 h-5 stroke-[#7A2E38] fill-none shrink-0" viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><text x="7" y="18" font-size="7" font-family="serif" font-weight="bold" fill="#7A2E38" stroke="none">PDF</text></svg>`;
  const docxSvg = `<svg class="w-5 h-5 stroke-[#9C7A3F] fill-none shrink-0" viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><text x="6.5" y="18" font-size="6.5" font-family="serif" font-weight="bold" fill="#9C7A3F" stroke="none">DOC</text></svg>`;
  const eyeSvg = `<svg class="w-3.5 h-3.5 stroke-current fill-none shrink-0" viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
  const robotSvg = `<svg class="w-3.5 h-3.5 stroke-current fill-none shrink-0" viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="10" rx="3"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4"/><line x1="8" y1="15" x2="8" y2="15.01"/><line x1="16" y1="15" x2="16" y2="15.01"/><line x1="9" y1="18" x2="15" y2="18"/></svg>`;
  const trashSvg = `<svg class="w-3.5 h-3.5 stroke-current fill-none shrink-0" viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>`;

  tbody.innerHTML = docs.map(doc => {
    let statusBadge = `<span class="px-2.5 py-1 bg-[#9C7A3F]/10 text-[#9C7A3F] border border-[#9C7A3F]/20 text-[10px] font-serif font-bold rounded">Ready</span>`;
    if (doc.status === 'processing') {
      statusBadge = `<span class="px-2.5 py-1 bg-[#FAF6EF] text-[#9C7A3F] border border-[#9C7A3F]/30 text-[10px] font-serif font-bold rounded animate-pulse">Processing...</span>`;
    } else if (doc.status === 'failed') {
      statusBadge = `<span class="px-2.5 py-1 bg-[#FDF2F1] text-[#8B2E28] border border-[#F5D5D3] text-[10px] font-serif font-bold rounded">Failed</span>`;
    }

    return `
      <tr class="hover:bg-[#FAF6EF]/60 transition-colors">
        <td class="py-3.5 px-4 font-semibold text-[#221B17] flex items-center gap-2">
          <span class="shrink-0 flex items-center justify-center">${doc.file_type === 'pdf' ? pdfSvg : docxSvg}</span>
          <span class="truncate max-w-[220px]" title="${escapeHtml(doc.title)}">${escapeHtml(doc.title)}</span>
        </td>
        <td class="py-3.5 px-4 text-xs font-mono uppercase text-[#8C827A]">${doc.file_type}</td>
        <td class="py-3.5 px-4 text-xs text-[#8C827A]">${formatBytes(doc.file_size)}</td>
        <td class="py-3.5 px-4 text-xs text-[#4A403A]">${doc.total_pages || 1} pgs / ${doc.total_chunks || 0} chunks</td>
        <td class="py-3.5 px-4">${statusBadge}</td>
        <td class="py-3.5 px-4 text-xs text-[#8C827A]">${new Date(doc.created_at).toLocaleDateString()}</td>
        <td class="py-3.5 px-4 text-right space-x-2">
          <button onclick="toggleFavoriteDocument(${doc.id}, ${doc.is_favorite ? 'true' : 'false'})" class="text-xs px-2.5 py-1 rounded border transition-colors inline-flex items-center gap-1 cursor-pointer ${doc.is_favorite ? 'bg-[#9C7A3F]/15 text-[#9C7A3F] border-[#9C7A3F]/40 font-bold' : 'bg-[#FAF6EF] text-[#8C827A] border-[#E5DDD0] hover:text-[#9C7A3F]'}" title="${doc.is_favorite ? 'Remove from Favorites' : 'Add to Favorites'}">
            <span>${doc.is_favorite ? '★ Starred' : '☆ Favorite'}</span>
          </button>
          <button onclick="previewDocument(${doc.id})" class="text-xs text-[#4A403A] hover:text-[#221B17] bg-[#FAF6EF] border border-[#E5DDD0] px-2.5 py-1 rounded inline-flex items-center gap-1">
            ${eyeSvg} <span>Preview</span>
          </button>
          <a href="assistant.html?session=${currentSession ? currentSession.id : ''}&doc=${doc.id}" class="btn-primary text-xs py-1 px-2.5 inline-flex items-center gap-1 bg-[#7A2E38] hover:bg-[#5A2129]">
            ${robotSvg} <span>Chat</span>
          </a>
          <button onclick="deleteDoc(${doc.id}, '${doc.title.replace(/'/g, "\\'")}')" class="text-xs text-[#8B2E28] hover:text-red-800 bg-[#FDF2F1] hover:bg-red-100 border border-[#F5D5D3] px-2 py-1 rounded transition-colors inline-flex items-center gap-1">
            ${trashSvg} <span>Delete</span>
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

async function toggleFavoriteDocument(docId, isFav) {
  try {
    const method = isFav ? 'DELETE' : 'POST';
    const url = isFav ? `/api/favorites/document/${docId}` : '/api/favorites';
    const body = isFav ? null : JSON.stringify({ documentId: docId });

    const res = await fetch(url, {
      method,
      headers: {
        ...getAuthHeader(),
        'Content-Type': 'application/json'
      },
      ...(body ? { body } : {})
    });

    if (res.ok) {
      if (currentSession) {
        await loadSessionDocuments(currentSession.id);
      }
    } else {
      alert('Failed to update favorite status.');
    }
  } catch (err) {
    alert('Error connecting to server.');
  }
}
if (typeof window !== 'undefined') {
  window.toggleFavoriteDocument = toggleFavoriteDocument;
}

function filterDocuments(query) {
  const q = query.toLowerCase().trim();
  const filtered = currentDocuments.filter(d => 
    d.title.toLowerCase().includes(q) || d.original_filename.toLowerCase().includes(q)
  );
  renderDocumentsTable(filtered);
}

function setupUploadForm() {
  const dropZone = document.getElementById('dropZone');
  const fileInput = document.getElementById('fileInput');
  const dropZoneText = document.getElementById('dropZoneText');
  const uploadSubmitBtn = document.getElementById('uploadSubmitBtn');
  const form = document.getElementById('docUploadForm');
  const progress = document.getElementById('uploadProgress');

  if (!dropZone || !form) return;

  dropZone.addEventListener('click', (e) => {
    if (e.target !== fileInput) {
      fileInput.click();
    }
  });

  ['dragenter', 'dragover'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      dropZone.classList.add('border-[#9C7A3F]', 'bg-[#FBF8F1]');
    });
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      dropZone.classList.remove('border-[#9C7A3F]', 'bg-[#FBF8F1]');
    });
  });

  dropZone.addEventListener('drop', (e) => {
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      fileInput.files = files;
      updateFileSelection();
    }
  });

  fileInput.addEventListener('change', updateFileSelection);

  function updateFileSelection() {
    if (fileInput.files.length > 0) {
      const file = fileInput.files[0];
      dropZoneText.innerHTML = `Selected: <strong class="text-[#9C7A3F]">${escapeHtml(file.name)}</strong> (${formatBytes(file.size)})`;
      uploadSubmitBtn.disabled = false;
      uploadSubmitBtn.classList.remove('opacity-50');
    }
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!fileInput.files[0]) return;

    uploadSubmitBtn.disabled = true;
    uploadSubmitBtn.classList.add('opacity-50');
    progress.classList.remove('hidden');

    const formData = new FormData();
    formData.append('document', fileInput.files[0]);
    if (currentSession) {
      formData.append('sessionId', currentSession.id);
    }

    try {
      const res = await fetch('/api/documents/upload', {
        method: 'POST',
        headers: getAuthHeader(),
        body: formData
      });
      const data = await res.json();

      if (res.ok) {
        fileInput.value = '';
        dropZoneText.innerHTML = 'Drag & Drop your document here, or <span class="text-[#9C7A3F] underline">browse file</span>';
        progress.classList.add('hidden');
        uploadSubmitBtn.disabled = true;
        if (currentSession) {
          await loadSessionDocuments(currentSession.id);
        }
      } else {
        alert(data.error || 'Failed to upload document.');
        progress.classList.add('hidden');
        uploadSubmitBtn.disabled = false;
        uploadSubmitBtn.classList.remove('opacity-50');
      }
    } catch (err) {
      alert('Network error during upload.');
      progress.classList.add('hidden');
      uploadSubmitBtn.disabled = false;
      uploadSubmitBtn.classList.remove('opacity-50');
    }
  });
}

async function previewDocument(id) {
  const modal = document.getElementById('previewModal');
  const titleEl = document.getElementById('modalDocTitle');
  const metaEl = document.getElementById('modalDocMeta');
  const contentEl = document.getElementById('modalDocContent');
  const askBtn = document.getElementById('modalAskBtn');

  if (!modal) return;
  modal.classList.remove('hidden');

  const doc = currentDocuments.find(d => d.id === id);
  if (doc) {
    titleEl.textContent = doc.title;
    metaEl.textContent = `${doc.file_type.toUpperCase()} • ${doc.total_pages || 1} Pages • ${doc.total_chunks || 0} Chunks`;
    if (askBtn) askBtn.href = `assistant.html?session=${currentSession ? currentSession.id : ''}&doc=${doc.id}`;
  }

  contentEl.innerHTML = '<p class="text-xs text-[#8C827A]">Loading document text...</p>';

  try {
    const [resDoc, resImages] = await Promise.all([
      fetch(`/api/documents/${id}`, { headers: getAuthHeader() }),
      fetch(`/api/documents/${id}/images`, { headers: getAuthHeader() }).catch(() => null)
    ]);
    if (!resDoc.ok) throw new Error('Failed to fetch document details');
    const fullDoc = await resDoc.json();
    const images = resImages && resImages.ok ? await resImages.json() : [];

    let imagesMarkup = '';
    if (images && images.length > 0) {
      const cleanDocTitle = (doc ? doc.title : 'Document').replace(/'/g, "\\'");
      imagesMarkup = `
        <div class="mb-4 p-3 bg-[#FAF6EF] border border-[#9C7A3F]/30 rounded-lg space-y-2">
          <div class="text-xs font-serif font-bold text-[#7A2E38] flex items-center justify-between">
            <span>📷 Extracted Document Figures (${images.length})</span>
            <span class="text-[10px] text-[#9C7A3F] font-sans font-normal">Click figure to view full size</span>
          </div>
          <div class="flex flex-wrap gap-2">
            ${images.map(img => `
              <div onclick="openLightbox('${img.imageUrl}', '${escapeHtml(cleanDocTitle)}', ${img.page || 1})" class="group relative cursor-pointer border border-[#E5DDD0] hover:border-[#9C7A3F] rounded bg-white p-1.5 transition-all shadow-xs hover:shadow">
                <img src="${img.imageUrl}" alt="Page ${img.page || 1} Figure" class="h-16 max-w-[120px] object-contain group-hover:scale-105 transition-transform" />
                <span class="absolute bottom-1 right-1 bg-black/70 text-white text-[9px] px-1 rounded font-mono">P. ${img.page || 1}</span>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }

    if (fullDoc.chunks && fullDoc.chunks.length > 0) {
      const chunksMarkup = fullDoc.chunks.map((c, i) => `
        <div class="p-3 bg-[#FAF6EF] border border-[#E5DDD0] rounded-md text-xs leading-relaxed space-y-1">
          <div class="flex items-center justify-between text-[11px] font-serif text-[#9C7A3F]">
            <span>Chunk #${i + 1} (Page ${c.page_number || 1})</span>
            <span>${escapeHtml(c.section_title || 'General')}</span>
          </div>
          <p class="text-[#221B17]">${escapeHtml(c.content)}</p>
        </div>
      `).join('');
      contentEl.innerHTML = imagesMarkup + chunksMarkup;
    } else {
      contentEl.innerHTML = imagesMarkup + '<p class="text-xs text-[#8C827A]">No text chunks extracted for this document.</p>';
    }
  } catch (err) {
    contentEl.innerHTML = '<p class="text-xs text-[#8B2E28]">Error loading document preview.</p>';
  }
}

function closePreviewModal() {
  const modal = document.getElementById('previewModal');
  if (modal) modal.classList.add('hidden');
}

async function deleteDoc(id, title) {
  if (!confirm(`Are you sure you want to delete "${title}"? This will remove all vector embeddings.`)) return;

  try {
    const res = await fetch(`/api/documents/${id}`, {
      method: 'DELETE',
      headers: getAuthHeader()
    });

    if (res.ok) {
      if (currentSession) {
        await loadSessionDocuments(currentSession.id);
      }
    } else {
      alert('Failed to delete document.');
    }
  } catch (err) {
    alert('Error connecting to server.');
  }
}
