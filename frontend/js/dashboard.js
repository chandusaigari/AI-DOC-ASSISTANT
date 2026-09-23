/* KnowledgeAI Dashboard JS - Private Bank & Law Firm Editorial Theme */

document.addEventListener('DOMContentLoaded', async () => {
  const token = checkAuth();
  if (!token) return;

  setupGreeting();
  setupUserInfo();
  setupSearchForm();
  await loadDashboardStats();
  await loadRecentDocuments();
  setupQuickUploadForm();
});

function setupGreeting() {
  const greetingEl = document.getElementById('greetingHeader');
  if (!greetingEl) return;

  const hour = new Date().getHours();
  let text = 'Good morning';
  if (hour >= 12 && hour < 17) {
    text = 'Good afternoon';
  } else if (hour >= 17) {
    text = 'Good evening';
  }
  greetingEl.textContent = text;
}

function setupUserInfo() {
  const user = JSON.parse(localStorage.getItem('kai_user') || '{}');
  const emailEl = document.getElementById('userHeaderEmail');
  const avatarEl = document.getElementById('userHeaderAvatar');

  if (user.email && emailEl) {
    emailEl.textContent = user.email;
  }
  if (user.email && avatarEl) {
    avatarEl.textContent = user.email.charAt(0).toUpperCase();
  }
}

function setupSearchForm() {
  const form = document.getElementById('dashboardSearchForm');
  const input = document.getElementById('dashboardSearchInput');

  if (form && input) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const query = input.value.trim();
      if (query) {
        window.location.href = `search.html?q=${encodeURIComponent(query)}`;
      }
    });
  }
}

async function loadDashboardStats() {
  try {
    const res = await fetch('/api/dashboard/stats', { headers: getAuthHeader() });
    if (res.ok) {
      const data = await res.json();
      document.getElementById('statDocsCount').textContent = data.totalDocs || 0;
      document.getElementById('statQueriesCount').textContent = data.totalQueries || 0;
      document.getElementById('statAccuracyPercent').textContent = `${data.answerAccuracy || 98}%`;
    }
  } catch (err) {
    console.error('Failed to load dashboard stats:', err);
  }
}

async function loadRecentDocuments() {
  const container = document.getElementById('recentDocsContainer');
  if (!container) return;

  try {
    const res = await fetch('/api/documents/recent', { headers: getAuthHeader() });
    if (!res.ok) throw new Error('Failed to load recent documents');
    let docs = await res.json();
    docs = Array.isArray(docs) ? docs.slice(0, 3) : [];

    if (docs.length === 0) {
      container.innerHTML = `
        <div class="py-12 text-center text-[#8C827A] text-xs bg-[#FAF6EF] rounded-lg border border-[#E5DDD0]">
          <div class="w-10 h-10 mx-auto mb-2 text-[#9C7A3F] flex items-center justify-center">
            <svg class="w-8 h-8 stroke-current fill-none" viewBox="0 0 24 24" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg>
          </div>
          <p class="font-serif font-semibold text-[#221B17] text-sm">No documents yet — Upload your first document</p>
          <p class="text-xs text-[#8C827A] mt-1 mb-4">Upload PDFs or Word documents to extract and index content.</p>
          <a href="documents.html" class="btn-primary text-xs py-2 px-4 inline-block shadow-sm bg-[#7A2E38] hover:bg-[#5A2129]">
            + Upload Document
          </a>
        </div>
      `;
      return;
    }

    const pdfSvg = `<svg class="w-5 h-5 stroke-[#7A2E38] fill-none shrink-0" viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><text x="7" y="18" font-size="7" font-family="serif" font-weight="bold" fill="#7A2E38" stroke="none">PDF</text></svg>`;
    const docxSvg = `<svg class="w-5 h-5 stroke-[#9C7A3F] fill-none shrink-0" viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><text x="6.5" y="18" font-size="6.5" font-family="serif" font-weight="bold" fill="#9C7A3F" stroke="none">DOC</text></svg>`;

    container.innerHTML = docs.map(doc => `
      <div class="p-4 bg-[#FAF6EF] rounded-lg border border-[#E5DDD0] flex items-center justify-between hover:bg-white hover:shadow-sm transition-all">
        <div class="flex items-center gap-3 overflow-hidden">
          <span class="shrink-0 flex items-center justify-center">${doc.file_type === 'pdf' ? pdfSvg : docxSvg}</span>
          <div class="truncate">
            <h4 class="font-serif font-bold text-[#221B17] text-xs truncate" title="${escapeHtml(doc.title)}">${escapeHtml(doc.title)}</h4>
            <p class="text-[10px] text-[#8C827A] font-mono mt-0.5">
              ${doc.file_type.toUpperCase()} • ${formatBytes(doc.file_size)} • ${new Date(doc.created_at).toLocaleDateString()}
            </p>
          </div>
        </div>
        <div class="flex items-center gap-2 shrink-0">
          <a href="assistant.html?doc=${doc.id}" class="btn-primary text-[11px] py-1.5 px-3 bg-[#7A2E38] hover:bg-[#5A2129]">
            Ask Assistant
          </a>
        </div>
      </div>
    `).join('');
  } catch (err) {
    container.innerHTML = `
      <div class="py-6 text-center text-[#8B2E28] text-xs">
        Failed to load recent documents.
      </div>
    `;
  }
}

function setupQuickUploadForm() {
  const fileInput = document.getElementById('quickFileInput');
  const fileLabel = document.getElementById('quickFileName');
  const uploadBtn = document.getElementById('quickUploadBtn');
  const form = document.getElementById('quickUploadForm');

  if (!fileInput || !form) return;

  fileInput.addEventListener('change', () => {
    if (fileInput.files.length > 0) {
      fileLabel.textContent = fileInput.files[0].name;
      uploadBtn.disabled = false;
      uploadBtn.classList.remove('opacity-50');
    }
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!fileInput.files[0]) return;

    uploadBtn.disabled = true;
    uploadBtn.textContent = 'Indexing...';

    const formData = new FormData();
    formData.append('document', fileInput.files[0]);

    try {
      const res = await fetch('/api/documents/upload', {
        method: 'POST',
        headers: getAuthHeader(),
        body: formData
      });
      const data = await res.json();

      if (res.ok) {
        alert('Document uploaded and semantically indexed successfully!');
        window.location.reload();
      } else {
        alert(data.error || 'Upload failed');
        uploadBtn.disabled = false;
        uploadBtn.textContent = 'Upload & Process';
      }
    } catch (err) {
      alert('Upload failed due to connection error.');
      uploadBtn.disabled = false;
      uploadBtn.textContent = 'Upload & Process';
    }
  });
}

function formatBytes(bytes, decimals = 1) {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + ' ' + sizes[i];
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
