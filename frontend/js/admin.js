/* KnowledgeAI Admin Control Center JS - Private Bank & Law Firm Editorial Theme */

let allUsersData = [];
let allDocsData = [];
let allLogsData = [];
let allFeedbackData = [];

document.addEventListener('DOMContentLoaded', async () => {
  const token = localStorage.getItem('kai_token');
  if (!token) {
    window.location.replace('login.html?admin=1');
    return;
  }

  const isAdmin = await verifyAdminAccess();
  if (!isAdmin) return;

  // Admin verified -> Reveal page content
  document.body.style.display = 'flex';

  setupUserInfo();
  await loadAdminStats();
  await loadAdminUsers();
  await loadAdminDocs();
  await loadAdminLogs();
  await loadAdminFeedbacks();

  setupSearchFilters();
});

async function verifyAdminAccess() {
  try {
    const res = await fetch('/api/auth/me', { headers: getAuthHeader() });
    if (res.ok) {
      const user = await res.json();
      if (user.role !== 'admin') {
        alert('Access Denied. Administrator privileges are required to view the Admin Control Center.');
        window.location.replace('home.html');
        return false;
      }
      return true;
    } else {
      window.location.replace('login.html?admin=1');
      return false;
    }
  } catch (err) {
    console.error('Failed to verify admin status:', err);
    window.location.replace('login.html?admin=1');
    return false;
  }
}

function setupUserInfo() {
  const user = JSON.parse(localStorage.getItem('kai_user') || '{}');
  const emailEl = document.getElementById('userHeaderEmail');
  const avatarEl = document.getElementById('userHeaderAvatar');

  if (user.email && emailEl) emailEl.textContent = user.email;
  if (user.email && avatarEl) avatarEl.textContent = user.email.charAt(0).toUpperCase();
}

async function loadAdminStats() {
  try {
    const res = await fetch('/api/admin/stats', { headers: getAuthHeader() });
    if (res.ok) {
      const stats = await res.json();
      if (document.getElementById('adminStatUsers')) document.getElementById('adminStatUsers').textContent = stats.totalUsers || 0;
      if (document.getElementById('adminStatDocs')) document.getElementById('adminStatDocs').textContent = stats.totalDocs || 0;
      if (document.getElementById('adminStatChunks')) document.getElementById('adminStatChunks').textContent = stats.totalChunks || 0;
      if (document.getElementById('adminStatQueries')) document.getElementById('adminStatQueries').textContent = stats.totalQueries || 0;
      if (document.getElementById('adminStatStorage')) document.getElementById('adminStatStorage').textContent = formatBytes(stats.totalBytes || 0);
      if (document.getElementById('adminStatFeedback')) {
        const ratingText = stats.avgRating ? ` (${stats.avgRating} ★)` : '';
        document.getElementById('adminStatFeedback').textContent = `${stats.totalFeedback || 0}${ratingText}`;
      }
    }
  } catch (err) {
    console.error('Error loading admin stats:', err);
  }
}

async function loadAdminUsers() {
  const tbody = document.getElementById('adminUsersTableBody');
  try {
    const res = await fetch('/api/admin/users', { headers: getAuthHeader() });
    if (!res.ok) throw new Error('Failed to load user list');
    allUsersData = await res.json();
    renderUsersTable(allUsersData);
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7" class="py-6 text-center text-[#8B2E28]">Failed to load user directory.</td></tr>`;
  }
}

function renderUsersTable(users) {
  const tbody = document.getElementById('adminUsersTableBody');
  const badgeEl = document.getElementById('userCountBadge');
  if (badgeEl) badgeEl.textContent = `Showing ${users.length} users`;

  if (!users || users.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="py-8 text-center text-[#8C827A]">No users found matching filter.</td></tr>`;
    return;
  }

  tbody.innerHTML = users.map(user => {
    const isAdmin = user.role === 'admin';
    const roleBadge = isAdmin
      ? `<span class="px-2.5 py-1 bg-[#7A2E38]/10 text-[#7A2E38] border border-[#7A2E38]/20 text-[10px] font-serif font-bold rounded">Admin</span>`
      : `<span class="px-2.5 py-1 bg-[#9C7A3F]/10 text-[#9C7A3F] border border-[#9C7A3F]/20 text-[10px] font-serif font-bold rounded">User</span>`;

    const nextRole = isAdmin ? 'user' : 'admin';
    const toggleRoleLabel = isAdmin ? 'Demote to User' : 'Promote to Admin';
    const toggleRoleClass = isAdmin ? 'bg-[#FAF6EF] text-[#4A403A] border-[#E5DDD0]' : 'bg-[#7A2E38] text-white hover:bg-[#5A2129]';

    return `
      <tr class="hover:bg-[#FAF6EF]/60 transition-colors">
        <td class="py-3 px-4 font-semibold text-[#221B17]">
          <div>${escapeHtml(user.fullName || 'User')}</div>
          <div class="text-[11px] text-[#8C827A] font-mono">${escapeHtml(user.email)}</div>
        </td>
        <td class="py-3 px-4">${roleBadge}</td>
        <td class="py-3 px-4 font-mono font-semibold text-[#221B17]">${user.totalDocs || 0} docs</td>
        <td class="py-3 px-4 font-mono font-semibold text-[#221B17]">${user.totalQueries || 0} queries</td>
        <td class="py-3 px-4 text-[#8C827A]">${formatBytes(user.totalBytes || 0)}</td>
        <td class="py-3 px-4 text-[#8C827A]">${new Date(user.createdAt).toLocaleDateString()}</td>
        <td class="py-3 px-4 text-right space-x-2">
          <button onclick="toggleUserRole(${user.id}, '${nextRole}', '${escapeHtml(user.email)}')" class="text-[11px] px-2.5 py-1 rounded border transition-colors inline-block ${toggleRoleClass}">
            ${toggleRoleLabel}
          </button>
          <button onclick="deleteUserByAdmin(${user.id}, '${escapeHtml(user.email)}')" class="text-[11px] text-[#8B2E28] hover:text-red-800 bg-[#FDF2F1] hover:bg-red-100 border border-[#F5D5D3] px-2 py-1 rounded transition-colors">
            Delete
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

async function toggleUserRole(userId, newRole, userEmail) {
  if (!confirm(`Are you sure you want to change role for ${userEmail} to "${newRole.toUpperCase()}"?`)) return;

  try {
    const res = await fetch(`/api/admin/users/${userId}/role`, {
      method: 'PUT',
      headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: newRole })
    });
    const data = await res.json();
    if (res.ok) {
      alert(`User role updated successfully.`);
      await loadAdminUsers();
    } else {
      alert(data.error || 'Failed to update user role.');
    }
  } catch (err) {
    alert('Error updating user role.');
  }
}

async function deleteUserByAdmin(userId, userEmail) {
  if (!confirm(`WARNING: Are you sure you want to PERMANENTLY DELETE user "${userEmail}" along with all their documents, vector chunks, and query logs?`)) return;

  try {
    const res = await fetch(`/api/admin/users/${userId}`, {
      method: 'DELETE',
      headers: getAuthHeader()
    });
    const data = await res.json();
    if (res.ok) {
      alert(`User deleted successfully.`);
      await loadAdminStats();
      await loadAdminUsers();
      await loadAdminDocs();
    } else {
      alert(data.error || 'Failed to delete user.');
    }
  } catch (err) {
    alert('Error deleting user.');
  }
}

async function loadAdminDocs() {
  const tbody = document.getElementById('adminDocsTableBody');
  try {
    const res = await fetch('/api/admin/documents', { headers: getAuthHeader() });
    if (!res.ok) throw new Error('Failed to load platform documents');
    allDocsData = await res.json();
    renderDocsTable(allDocsData);
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="8" class="py-6 text-center text-[#8B2E28]">Failed to load document library.</td></tr>`;
  }
}

function renderDocsTable(docs) {
  const tbody = document.getElementById('adminDocsTableBody');
  const badgeEl = document.getElementById('docCountBadge');
  if (badgeEl) badgeEl.textContent = `Showing ${docs.length} documents`;

  if (!docs || docs.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="py-8 text-center text-[#8C827A]">No documents found matching filter.</td></tr>`;
    return;
  }

  const pdfSvg = `<svg class="w-4 h-4 stroke-[#7A2E38] fill-none shrink-0" viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><text x="7" y="18" font-size="7" font-family="serif" font-weight="bold" fill="#7A2E38" stroke="none">PDF</text></svg>`;
  const docxSvg = `<svg class="w-4 h-4 stroke-[#9C7A3F] fill-none shrink-0" viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><text x="6.5" y="18" font-size="6.5" font-family="serif" font-weight="bold" fill="#9C7A3F" stroke="none">DOC</text></svg>`;

  tbody.innerHTML = docs.map(doc => {
    let statusBadge = `<span class="px-2 py-0.5 bg-[#9C7A3F]/10 text-[#9C7A3F] border border-[#9C7A3F]/20 text-[10px] font-serif font-bold rounded">Ready</span>`;
    if (doc.status === 'processing') {
      statusBadge = `<span class="px-2 py-0.5 bg-[#FAF6EF] text-[#9C7A3F] border border-[#9C7A3F]/30 text-[10px] font-serif font-bold rounded animate-pulse">Processing...</span>`;
    } else if (doc.status === 'failed') {
      statusBadge = `<span class="px-2 py-0.5 bg-[#FDF2F1] text-[#8B2E28] border border-[#F5D5D3] text-[10px] font-serif font-bold rounded">Failed</span>`;
    }

    return `
      <tr class="hover:bg-[#FAF6EF]/60 transition-colors">
        <td class="py-3 px-4 font-semibold text-[#221B17] flex items-center gap-2">
          <span class="shrink-0 flex items-center justify-center">${doc.file_type === 'pdf' ? pdfSvg : docxSvg}</span>
          <span class="truncate max-w-[200px]" title="${escapeHtml(doc.title)}">${escapeHtml(doc.title)}</span>
        </td>
        <td class="py-3 px-4">
          <div class="font-medium text-[#221B17]">${escapeHtml(doc.owner_name || 'User')}</div>
          <div class="text-[10px] text-[#8C827A] font-mono">${escapeHtml(doc.owner_email || '')}</div>
        </td>
        <td class="py-3 px-4 font-mono uppercase text-[#8C827A] text-[11px]">${doc.file_type}</td>
        <td class="py-3 px-4 text-[#8C827A]">${formatBytes(doc.file_size)}</td>
        <td class="py-3 px-4 text-[#4A403A]">${doc.total_pages || 1} pgs / ${doc.total_chunks || 0} chunks</td>
        <td class="py-3 px-4">${statusBadge}</td>
        <td class="py-3 px-4 text-[#8C827A]">${new Date(doc.created_at).toLocaleDateString()}</td>
        <td class="py-3 px-4 text-right space-x-2">
          <button onclick="previewAdminDoc(${doc.id})" class="text-[11px] text-[#4A403A] hover:text-[#221B17] bg-[#FAF6EF] border border-[#E5DDD0] px-2 py-1 rounded inline-block">
            Preview
          </button>
          <button onclick="deleteDocByAdmin(${doc.id}, '${escapeHtml(doc.title.replace(/'/g, "\\'"))}')" class="text-[11px] text-[#8B2E28] hover:text-red-800 bg-[#FDF2F1] hover:bg-red-100 border border-[#F5D5D3] px-2 py-1 rounded transition-colors inline-block">
            Delete
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

async function previewAdminDoc(docId) {
  const modal = document.getElementById('adminPreviewModal');
  const titleEl = document.getElementById('adminModalTitle');
  const metaEl = document.getElementById('adminModalMeta');
  const contentEl = document.getElementById('adminModalContent');

  const doc = allDocsData.find(d => d.id === docId);
  if (!doc) return;

  titleEl.textContent = doc.title;
  metaEl.textContent = `Owner: ${doc.owner_email} • ${doc.file_type.toUpperCase()} • ${doc.total_pages || 1} Pages • ${doc.total_chunks || 0} Chunks`;
  contentEl.textContent = doc.extracted_text || 'No text extracted for this document.';

  modal.classList.remove('hidden');
}

function closeAdminPreviewModal() {
  document.getElementById('adminPreviewModal').classList.add('hidden');
}

async function deleteDocByAdmin(docId, docTitle) {
  if (!confirm(`Are you sure you want to delete document "${docTitle}" as admin?`)) return;

  try {
    const res = await fetch(`/api/admin/documents/${docId}`, {
      method: 'DELETE',
      headers: getAuthHeader()
    });
    if (res.ok) {
      alert('Document deleted successfully.');
      await loadAdminStats();
      await loadAdminDocs();
    } else {
      alert('Failed to delete document.');
    }
  } catch (err) {
    alert('Error deleting document.');
  }
}

async function loadAdminLogs() {
  const tbody = document.getElementById('adminLogsTableBody');
  try {
    const res = await fetch('/api/admin/logs', { headers: getAuthHeader() });
    if (!res.ok) throw new Error('Failed to load RAG activity logs');
    allLogsData = await res.json();
    renderLogsTable(allLogsData);
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" class="py-6 text-center text-[#8B2E28]">Failed to load RAG query logs.</td></tr>`;
  }
}

function renderLogsTable(logs) {
  const tbody = document.getElementById('adminLogsTableBody');
  const badgeEl = document.getElementById('logCountBadge');
  if (badgeEl) badgeEl.textContent = `Showing ${logs.length} logs`;

  if (!logs || logs.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="py-8 text-center text-[#8C827A]">No RAG query logs recorded yet.</td></tr>`;
    return;
  }

  tbody.innerHTML = logs.map(log => {
    const citationsCount = Array.isArray(log.citations) ? log.citations.length : 0;
    const answerSnippet = (log.answer || '').replace(/<[^>]*>/g, '').substring(0, 120);

    return `
      <tr class="hover:bg-[#FAF6EF]/60 transition-colors">
        <td class="py-3 px-4 text-[#8C827A] font-mono text-[11px] whitespace-nowrap">
          ${new Date(log.created_at).toLocaleString()}
        </td>
        <td class="py-3 px-4">
          <div class="font-medium text-[#221B17]">${escapeHtml(log.user_name || 'User')}</div>
          <div class="text-[10px] text-[#8C827A] font-mono">${escapeHtml(log.user_email || '')}</div>
        </td>
        <td class="py-3 px-4 font-serif text-[#9C7A3F] font-semibold text-[11px]">
          ${escapeHtml(log.document_title || 'All Documents')}
        </td>
        <td class="py-3 px-4 font-semibold text-[#221B17] max-w-[220px] truncate" title="${escapeHtml(log.question)}">
          ${escapeHtml(log.question)}
        </td>
        <td class="py-3 px-4 text-[#4A403A] max-w-[280px] truncate" title="${escapeHtml(answerSnippet)}">
          ${escapeHtml(answerSnippet)}...
        </td>
        <td class="py-3 px-4">
          <span class="px-2 py-0.5 bg-[#9C7A3F]/10 text-[#9C7A3F] border border-[#9C7A3F]/20 text-[10px] font-serif font-bold rounded">
            ${citationsCount} citations
          </span>
        </td>
      </tr>
    `;
  }).join('');
}

function switchAdminTab(tab) {
  const tabBtnUsers = document.getElementById('tabBtnUsers');
  const tabBtnDocs = document.getElementById('tabBtnDocs');
  const tabBtnLogs = document.getElementById('tabBtnLogs');
  const tabBtnFeedback = document.getElementById('tabBtnFeedback');

  const tabContentUsers = document.getElementById('tabContentUsers');
  const tabContentDocs = document.getElementById('tabContentDocs');
  const tabContentLogs = document.getElementById('tabContentLogs');
  const tabContentFeedback = document.getElementById('tabContentFeedback');

  const activeClass = 'border-[#7A2E38] text-[#7A2E38]';
  const inactiveClass = 'border-transparent text-[#8C827A] hover:text-[#221B17]';

  if (tabBtnUsers) tabBtnUsers.className = `py-2.5 px-4 border-b-2 ${tab === 'users' ? activeClass : inactiveClass} transition-all flex items-center gap-2 cursor-pointer`;
  if (tabBtnDocs) tabBtnDocs.className = `py-2.5 px-4 border-b-2 ${tab === 'docs' ? activeClass : inactiveClass} transition-all flex items-center gap-2 cursor-pointer`;
  if (tabBtnLogs) tabBtnLogs.className = `py-2.5 px-4 border-b-2 ${tab === 'logs' ? activeClass : inactiveClass} transition-all flex items-center gap-2 cursor-pointer`;
  if (tabBtnFeedback) tabBtnFeedback.className = `py-2.5 px-4 border-b-2 ${tab === 'feedback' ? activeClass : inactiveClass} transition-all flex items-center gap-2 cursor-pointer`;

  if (tabContentUsers) tabContentUsers.classList.toggle('hidden', tab !== 'users');
  if (tabContentDocs) tabContentDocs.classList.toggle('hidden', tab !== 'docs');
  if (tabContentLogs) tabContentLogs.classList.toggle('hidden', tab !== 'logs');
  if (tabContentFeedback) tabContentFeedback.classList.toggle('hidden', tab !== 'feedback');

  if (tab === 'feedback') loadAdminFeedbacks();
  if (tab === 'users') loadAdminUsers();
  if (tab === 'docs') loadAdminDocs();
  if (tab === 'logs') loadAdminLogs();
}

async function loadAdminFeedbacks() {
  const tbody = document.getElementById('adminFeedbackTableBody');
  if (!tbody) return;

  try {
    const res = await fetch('/api/admin/feedbacks', { headers: getAuthHeader() });
    if (!res.ok) throw new Error('Failed to load user feedback entries');
    allFeedbackData = await res.json();
    renderFeedbackTable(allFeedbackData);
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" class="py-6 text-center text-[#8B2E28]">Failed to load user feedback entries.</td></tr>`;
  }
}

function renderFeedbackTable(feedbacks) {
  const tbody = document.getElementById('adminFeedbackTableBody');
  const badgeEl = document.getElementById('feedbackCountBadge');
  if (!tbody) return;
  if (badgeEl) badgeEl.textContent = `Showing ${feedbacks.length} feedbacks`;

  if (!feedbacks || feedbacks.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="py-8 text-center text-[#8C827A]">No user feedback entries found.</td></tr>`;
    return;
  }

  tbody.innerHTML = feedbacks.map(f => {
    const stars = '★'.repeat(f.rating) + '☆'.repeat(5 - f.rating);
    return `
      <tr class="hover:bg-[#FAF6EF]/60 transition-colors">
        <td class="py-3 px-4 text-[#8C827A] font-mono text-[11px] whitespace-nowrap">
          ${new Date(f.created_at).toLocaleString()}
        </td>
        <td class="py-3 px-4 font-mono text-xs font-bold text-[#221B17]">
          ${escapeHtml(f.user_email || f.user_name || 'User')}
        </td>
        <td class="py-3 px-4">
          <span class="px-2 py-0.5 bg-[#9C7A3F]/10 text-[#9C7A3F] border border-[#9C7A3F]/20 text-[10px] font-serif font-bold rounded">
            ${escapeHtml(f.category)}
          </span>
        </td>
        <td class="py-3 px-4 font-bold text-[#9C7A3F]">
          ${stars} (${f.rating}/5)
        </td>
        <td class="py-3 px-4 text-[#221B17] max-w-[300px] leading-relaxed">
          ${escapeHtml(f.message)}
        </td>
        <td class="py-3 px-4 text-right">
          <button onclick="deleteFeedbackByAdmin(${f.id})" class="text-[11px] text-[#8B2E28] hover:text-red-800 bg-[#FDF2F1] hover:bg-red-100 border border-[#F5D5D3] px-2 py-1 rounded transition-colors inline-block">
            Delete
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

async function deleteFeedbackByAdmin(feedbackId) {
  if (!confirm('Are you sure you want to delete this user feedback entry?')) return;

  try {
    const res = await fetch(`/api/admin/feedbacks/${feedbackId}`, {
      method: 'DELETE',
      headers: getAuthHeader()
    });
    if (res.ok) {
      alert('Feedback entry deleted.');
      await loadAdminFeedbacks();
    } else {
      alert('Failed to delete feedback entry.');
    }
  } catch (err) {
    alert('Error deleting feedback entry.');
  }
}

function setupSearchFilters() {
  const userSearch = document.getElementById('userSearchInput');
  if (userSearch) {
    userSearch.addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase().trim();
      const filtered = allUsersData.filter(u => 
        (u.fullName || '').toLowerCase().includes(q) ||
        (u.email || '').toLowerCase().includes(q) ||
        (u.role || '').toLowerCase().includes(q)
      );
      renderUsersTable(filtered);
    });
  }

  const docSearch = document.getElementById('docSearchInput');
  if (docSearch) {
    docSearch.addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase().trim();
      const filtered = allDocsData.filter(d => 
        (d.title || '').toLowerCase().includes(q) ||
        (d.owner_email || '').toLowerCase().includes(q) ||
        (d.owner_name || '').toLowerCase().includes(q)
      );
      renderDocsTable(filtered);
    });
  }

  const logSearch = document.getElementById('logSearchInput');
  if (logSearch) {
    logSearch.addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase().trim();
      const filtered = allLogsData.filter(l => 
        (l.question || '').toLowerCase().includes(q) ||
        (l.answer || '').toLowerCase().includes(q) ||
        (l.user_email || '').toLowerCase().includes(q) ||
        (l.user_name || '').toLowerCase().includes(q) ||
        (l.document_title || '').toLowerCase().includes(q)
      );
      renderLogsTable(filtered);
    });
  }

  const feedbackSearch = document.getElementById('feedbackSearchInput');
  if (feedbackSearch) {
    feedbackSearch.addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase().trim();
      const filtered = allFeedbackData.filter(f => 
        (f.message || '').toLowerCase().includes(q) ||
        (f.category || '').toLowerCase().includes(q) ||
        (f.user_email || '').toLowerCase().includes(q) ||
        (f.user_name || '').toLowerCase().includes(q)
      );
      renderFeedbackTable(filtered);
    });
  }
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
