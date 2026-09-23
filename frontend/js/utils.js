/* KnowledgeAI Shared Frontend Utilities */

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatBytes(bytes, decimals = 1) {
  if (!bytes || bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

function openLightbox(imageUrl, docTitle, pageNum) {
  let modal = document.getElementById('imageLightboxModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'imageLightboxModal';
    modal.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 transition-all hidden';
    modal.innerHTML = `
      <div class="relative max-w-4xl max-h-[90vh] w-full bg-[#FAF6EF] border border-[#9C7A3F]/40 rounded-2xl shadow-2xl p-6 overflow-hidden flex flex-col items-center">
        <button onclick="closeLightbox()" class="absolute top-3 right-3 text-[#1C1613]/70 hover:text-[#7A2E38] transition p-2 rounded-full hover:bg-black/10 cursor-pointer" title="Close (Esc)">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
        <div class="mb-4 text-center">
          <h3 id="lightboxDocName" class="text-base sm:text-lg font-serif font-bold text-[#1C1613]">Document Image</h3>
          <p id="lightboxDocPage" class="text-xs text-[#9C7A3F] font-semibold">Extracted Page Figure</p>
        </div>
        <div class="flex-1 overflow-auto flex items-center justify-center w-full p-3 bg-white/70 rounded-xl border border-black/5 shadow-inner">
          <img id="lightboxImage" src="" alt="Extracted Document Figure" class="max-h-[70vh] max-w-full object-contain rounded-lg shadow-sm" />
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeLightbox();
    });
  }

  const cleanDocTitle = docTitle || 'Document Image';
  const cleanDocPage = pageNum ? `Extracted from Page ${pageNum}` : 'Embedded Figure';

  const imgEl = document.getElementById('lightboxImage');
  const titleEl = document.getElementById('lightboxDocName');
  const pageEl = document.getElementById('lightboxDocPage');

  if (imgEl) imgEl.src = imageUrl;
  if (titleEl) titleEl.textContent = cleanDocTitle;
  if (pageEl) pageEl.textContent = cleanDocPage;

  modal.classList.remove('hidden');

  if (!window._lightboxKeydownBound) {
    window._lightboxKeydownBound = true;
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeLightbox();
      }
    });
  }
}

function closeLightbox() {
  const modal = document.getElementById('imageLightboxModal');
  if (modal) {
    modal.classList.add('hidden');
    const imgEl = document.getElementById('lightboxImage');
    if (imgEl) imgEl.src = '';
  }
}

function copyCodeToClipboard(btn) {
  try {
    const rawCode = decodeURIComponent(btn.getAttribute('data-code') || '');
    if (!rawCode) return;
    navigator.clipboard.writeText(rawCode).then(() => {
      const span = btn.querySelector('span');
      const originalText = span ? span.textContent : 'Copy';
      if (span) span.textContent = 'Copied!';
      setTimeout(() => {
        if (span) span.textContent = originalText;
      }, 2000);
    });
  } catch (e) {
    console.error('Failed to copy code:', e);
  }
}

async function toggleFavoriteDocument(docId, isFav, callback = null) {
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
      if (typeof callback === 'function') callback();
      return true;
    } else {
      alert('Failed to update favorite status.');
      return false;
    }
  } catch (err) {
    alert('Error connecting to server.');
    return false;
  }
}

if (typeof window !== 'undefined') {
  window.escapeHtml = escapeHtml;
  window.formatBytes = formatBytes;
  window.openLightbox = openLightbox;
  window.closeLightbox = closeLightbox;
  window.copyCodeToClipboard = copyCodeToClipboard;
  window.toggleFavoriteDocument = toggleFavoriteDocument;
}
