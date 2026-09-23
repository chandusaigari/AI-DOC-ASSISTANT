/* KnowledgeAI Shared Session Grid Component */

const EMOJI_OPTIONS = ['📁', '💻', '🌐', '📚', '⚖️', '🧬', '🔬', '📊', '🤖', '💡'];

let currentSessionsList = [];

async function fetchSessions() {
  try {
    const res = await fetch('/api/sessions', { headers: getAuthHeader() });
    if (res.ok) {
      currentSessionsList = await res.json();
      return currentSessionsList;
    }
  } catch (err) {
    console.error('Failed to fetch sessions:', err);
  }
  return [];
}

async function renderSessionGrid(containerId, options = {}) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const sessions = await fetchSessions();
  const { 
    onSelectSession, 
    pageTitle = 'Collections', 
    pageSubtitle = 'Select a subject collection to view files and ask questions.',
    allowCreate = true 
  } = options;

  let gridHtml = `
    <div class="mb-6 flex items-center justify-between">
      <div>
        <h2 class="text-xl sm:text-2xl font-serif font-bold text-[#1C1613] tracking-tight">${escapeHtml(pageTitle)}</h2>
        <p class="text-xs sm:text-sm text-[#8C827A] mt-1">${escapeHtml(pageSubtitle)}</p>
      </div>
      ${allowCreate ? `
      <button onclick="openNewSessionModal()" class="px-4 py-2 rounded-lg bg-[#7A2E38] hover:bg-[#66242D] text-[#FAF6EF] text-xs font-serif font-semibold shadow-xs transition inline-flex items-center gap-2 cursor-pointer">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15"/></svg>
        <span>New Session</span>
      </button>
      ` : ''}
    </div>
  `;

  if (sessions.length === 0 && !allowCreate) {
    gridHtml += `
      <div class="bg-white border border-[#E5DDD0] rounded-2xl p-10 text-center shadow-xs max-w-lg mx-auto my-8">
        <div class="w-16 h-16 rounded-full bg-[#FAF6EF] border border-[#E5DDD0] text-[#9C7A3F] flex items-center justify-center mx-auto mb-4 text-2xl">
          📁
        </div>
        <h3 class="text-lg font-serif font-bold text-[#1C1613]">No Sessions Available</h3>
        <p class="text-xs sm:text-sm text-[#8C827A] mt-2 mb-6">You haven't created any sessions yet — go to Documents to create one and upload your files.</p>
        <a href="documents.html" class="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#7A2E38] hover:bg-[#66242D] text-[#FAF6EF] text-xs font-serif font-semibold shadow-xs transition">
          <span>Go to Documents</span>
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"/></svg>
        </a>
      </div>
    `;
    container.innerHTML = gridHtml;
    window._onSelectSessionHandler = onSelectSession;
    return;
  }

  gridHtml += `
    <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
  `;

  sessions.forEach(session => {
    const docCount = session.document_count || 0;
    const docBadgeText = `${docCount} document${docCount === 1 ? '' : 's'}`;
    const icon = session.icon || '📁';
    const cleanName = escapeHtml(session.name);
    const updatedDate = session.updated_at ? new Date(session.updated_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '';

    gridHtml += `
      <div onclick="handleSessionClick(${session.id})" 
           class="group relative bg-white border border-[#E5DDD0] rounded-xl p-5 shadow-xs hover:shadow-md hover:border-[#9C7A3F]/60 transition-all cursor-pointer flex flex-col justify-between h-44 hover:-translate-y-0.5">
        
        <div class="flex items-start justify-between gap-2">
          <div class="w-10 h-10 rounded-lg bg-[#FAF6EF] border border-[#E5DDD0] flex items-center justify-center text-xl shrink-0 group-hover:scale-105 transition-transform">
            ${icon}
          </div>
          <div class="relative z-10" onclick="event.stopPropagation()">
            <button onclick="toggleSessionMenu(${session.id}, event)" class="p-1 rounded-md text-[#8C827A] hover:text-[#1C1613] hover:bg-[#FAF6EF] transition">
              <svg class="w-4 h-4 fill-current" viewBox="0 0 24 24"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>
            </button>
            <div id="sessionMenu-${session.id}" class="hidden absolute right-0 mt-1 w-36 bg-white border border-[#E5DDD0] rounded-lg shadow-lg py-1 text-xs z-30">
              <button onclick="openRenameSessionModal(${session.id}, '${cleanName.replace(/'/g, "\\'")}', '${icon}')" class="w-full text-left px-3 py-2 text-[#221B17] hover:bg-[#FAF6EF] flex items-center gap-2">
                <svg class="w-3.5 h-3.5 text-[#8C827A]" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.89 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.89L16.863 4.487z"/></button>
                Rename
              </button>
              <button onclick="openDeleteSessionModal(${session.id}, '${cleanName.replace(/'/g, "\\'")}')" class="w-full text-left px-3 py-2 text-[#7A2E38] hover:bg-[#FAF6EF] flex items-center gap-2 font-semibold">
                <svg class="w-3.5 h-3.5 text-[#7A2E38]" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"/></svg>
                Delete
              </button>
            </div>
          </div>
        </div>

        <div class="mt-3">
          <h3 class="text-base font-serif font-bold text-[#1C1613] group-hover:text-[#7A2E38] transition-colors truncate" title="${cleanName}">
            ${cleanName}
          </h3>
          <div class="mt-2 flex items-center justify-between text-xs">
            <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#FAF6EF] text-[#9C7A3F] border border-[#9C7A3F]/20">
              ${docBadgeText}
            </span>
            ${updatedDate ? `<span class="text-[10px] text-[#8C827A]">${updatedDate}</span>` : ''}
          </div>
        </div>
      </div>
    `;
  });

  if (allowCreate) {
    gridHtml += `
      <div onclick="openNewSessionModal()" 
           class="group border-2 border-dashed border-[#E5DDD0] hover:border-[#7A2E38] bg-[#FAF6EF]/50 hover:bg-[#FAF6EF] rounded-xl p-5 flex flex-col items-center justify-center text-center h-44 cursor-pointer transition-all">
        <div class="w-10 h-10 rounded-full bg-white border border-[#E5DDD0] group-hover:border-[#7A2E38] flex items-center justify-center text-[#7A2E38] shadow-xs group-hover:scale-110 transition-all mb-2">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15"/></svg>
        </div>
        <span class="text-sm font-serif font-bold text-[#1C1613] group-hover:text-[#7A2E38] transition-colors">New Session</span>
        <span class="text-[11px] text-[#8C827A] mt-0.5">Create subject collection</span>
      </div>
    `;
  }

  gridHtml += `</div>`;

  container.innerHTML = gridHtml;

  // Store callback on window for session clicks
  window._onSelectSessionHandler = onSelectSession;
}

function handleSessionClick(sessionId) {
  const session = currentSessionsList.find(s => s.id === sessionId);
  if (session && typeof window._onSelectSessionHandler === 'function') {
    window._onSelectSessionHandler(session);
  }
}

function toggleSessionMenu(sessionId, e) {
  e.stopPropagation();
  // Close all other menus
  document.querySelectorAll('[id^="sessionMenu-"]').forEach(m => {
    if (m.id !== `sessionMenu-${sessionId}`) m.classList.add('hidden');
  });
  const menu = document.getElementById(`sessionMenu-${sessionId}`);
  if (menu) menu.classList.toggle('hidden');
}

// Close menus on document click
document.addEventListener('click', () => {
  document.querySelectorAll('[id^="sessionMenu-"]').forEach(m => m.classList.add('hidden'));
});

// Modals Setup
function openNewSessionModal() {
  let modal = document.getElementById('sessionCreateModal');
  if (!modal) {
    modal = createSessionModalElement();
    document.body.appendChild(modal);
  }
  document.getElementById('sessionModalTitle').textContent = 'Create New Session';
  document.getElementById('sessionModalId').value = '';
  document.getElementById('sessionNameInput').value = '';
  selectEmojiOption('📁');
  modal.classList.remove('hidden');
  document.getElementById('sessionNameInput').focus();
}

function openRenameSessionModal(id, currentName, currentIcon) {
  let modal = document.getElementById('sessionCreateModal');
  if (!modal) {
    modal = createSessionModalElement();
    document.body.appendChild(modal);
  }
  document.getElementById('sessionModalTitle').textContent = 'Rename Session';
  document.getElementById('sessionModalId').value = id;
  document.getElementById('sessionNameInput').value = currentName;
  selectEmojiOption(currentIcon || '📁');
  modal.classList.remove('hidden');
  document.getElementById('sessionNameInput').focus();
}

function selectEmojiOption(emoji) {
  document.getElementById('selectedSessionIcon').value = emoji;
  document.querySelectorAll('.emoji-picker-btn').forEach(btn => {
    if (btn.getAttribute('data-emoji') === emoji) {
      btn.classList.add('border-[#7A2E38]', 'bg-[#FAF6EF]', 'scale-110');
      btn.classList.remove('border-transparent');
    } else {
      btn.classList.remove('border-[#7A2E38]', 'bg-[#FAF6EF]', 'scale-110');
      btn.classList.add('border-transparent');
    }
  });
}

function createSessionModalElement() {
  const modal = document.createElement('div');
  modal.id = 'sessionCreateModal';
  modal.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 hidden';

  const emojiButtons = EMOJI_OPTIONS.map(e => `
    <button type="button" onclick="selectEmojiOption('${e}')" data-emoji="${e}" className="emoji-picker-btn p-2 text-xl rounded-lg border transition-all hover:bg-[#FAF6EF] cursor-pointer">
      ${e}
    </button>
  `).join('');

  modal.innerHTML = `
    <div class="bg-white border border-[#E5DDD0] rounded-2xl shadow-2xl max-w-md w-full p-6 relative">
      <h3 id="sessionModalTitle" class="text-lg font-serif font-bold text-[#1C1613]">Create New Session</h3>
      <p class="text-xs text-[#8C827A] mt-1">Group your documents into a subject collection (e.g. DBMS, Computer Networks).</p>

      <form onsubmit="submitSessionForm(event)" class="mt-4 space-y-4">
        <input type="hidden" id="sessionModalId" value="" />
        <input type="hidden" id="selectedSessionIcon" value="📁" />

        <div>
          <label class="block text-xs font-serif font-semibold text-[#1C1613] mb-1">Session Name</label>
          <input type="text" id="sessionNameInput" required placeholder="e.g. DBMS, Computer Networks, Operating Systems" 
                 class="w-full px-3.5 py-2.5 rounded-lg border border-[#E5DDD0] bg-[#FAF6EF]/50 text-xs sm:text-sm focus:outline-none focus:border-[#7A2E38] focus:ring-1 focus:ring-[#7A2E38]" />
        </div>

        <div>
          <label class="block text-xs font-serif font-semibold text-[#1C1613] mb-1.5">Tag Icon</label>
          <div class="flex flex-wrap gap-1.5 p-2 bg-[#FAF6EF]/40 rounded-xl border border-[#E5DDD0]/60">
            ${emojiButtons}
          </div>
        </div>

        <div class="flex items-center justify-end gap-3 pt-3 border-t border-[#E5DDD0]">
          <button type="button" onclick="closeSessionModal()" class="px-4 py-2 rounded-lg border border-[#E5DDD0] text-xs font-serif font-semibold text-[#8C827A] hover:bg-[#FAF6EF] transition">Cancel</button>
          <button type="submit" class="px-5 py-2 rounded-lg bg-[#7A2E38] hover:bg-[#66242D] text-[#FAF6EF] text-xs font-serif font-semibold shadow-xs transition">Save Session</button>
        </div>
      </form>
    </div>
  `;
  return modal;
}

function closeSessionModal() {
  const modal = document.getElementById('sessionCreateModal');
  if (modal) modal.classList.add('hidden');
}

let isSessionSubmitting = false;

async function submitSessionForm(e) {
  e.preventDefault();
  if (isSessionSubmitting) return;

  const id = document.getElementById('sessionModalId').value;
  const name = document.getElementById('sessionNameInput').value.trim();
  const icon = document.getElementById('selectedSessionIcon').value || '📁';

  if (!name) return;

  isSessionSubmitting = true;

  const modal = document.getElementById('sessionCreateModal');
  const submitBtn = modal ? modal.querySelector('button[type="submit"]') : null;
  const origBtnText = submitBtn ? submitBtn.textContent : 'Save Session';

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving...';
  }

  try {
    let res;
    if (id) {
      res = await fetch(`/api/sessions/${id}`, {
        method: 'PATCH',
        headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, icon })
      });
    } else {
      res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, icon })
      });
    }

    if (res.ok) {
      const savedSession = await res.json();
      closeSessionModal();
      // Refresh active grid
      if (typeof window.refreshActiveSessionGrid === 'function') {
        window.refreshActiveSessionGrid();
      }
      if (!id && typeof window._onSelectSessionHandler === 'function') {
        window._onSelectSessionHandler(savedSession);
      }
    } else {
      const err = await res.json();
      alert(err.error || 'Failed to save session');
    }
  } catch (err) {
    console.error('Save session error:', err);
  } finally {
    isSessionSubmitting = false;
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = origBtnText;
    }
  }
}

// Delete Session Modal
function openDeleteSessionModal(id, name) {
  let modal = document.getElementById('sessionDeleteModal');
  if (!modal) {
    modal = createDeleteSessionModalElement();
    document.body.appendChild(modal);
  }
  document.getElementById('deleteSessionId').value = id;
  document.getElementById('deleteSessionNameText').textContent = name;
  modal.classList.remove('hidden');
}

function createDeleteSessionModalElement() {
  const modal = document.createElement('div');
  modal.id = 'sessionDeleteModal';
  modal.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 hidden';

  modal.innerHTML = `
    <div class="bg-white border border-[#E5DDD0] rounded-2xl shadow-2xl max-w-md w-full p-6 relative">
      <h3 class="text-lg font-serif font-bold text-[#1C1613]">Delete Session</h3>
      <p class="text-xs text-[#8C827A] mt-1">What would you like to do with the documents inside "<span id="deleteSessionNameText" class="font-bold text-[#1C1613]"></span>"?</p>
      
      <input type="hidden" id="deleteSessionId" value="" />

      <div class="mt-4 space-y-3">
        <label class="flex items-start gap-3 p-3 rounded-xl border border-[#E5DDD0] bg-[#FAF6EF]/50 hover:border-[#7A2E38] cursor-pointer transition">
          <input type="radio" name="deleteOption" value="keep" checked class="mt-1 text-[#7A2E38] focus:ring-[#7A2E38]" />
          <div>
            <div class="text-xs font-serif font-bold text-[#1C1613]">Keep documents (Recommended)</div>
            <div class="text-[11px] text-[#8C827A]">Move documents to your default "General" session so files are not lost.</div>
          </div>
        </label>

        <label class="flex items-start gap-3 p-3 rounded-xl border border-red-200 bg-red-50/40 hover:border-red-400 cursor-pointer transition">
          <input type="radio" name="deleteOption" value="delete" class="mt-1 text-red-600 focus:ring-red-600" />
          <div>
            <div class="text-xs font-serif font-bold text-red-900">Delete documents permanently</div>
            <div class="text-[11px] text-red-700">Delete all uploaded PDFs and chunks in this session.</div>
          </div>
        </label>
      </div>

      <div class="flex items-center justify-end gap-3 pt-4 mt-4 border-t border-[#E5DDD0]">
        <button type="button" onclick="closeDeleteSessionModal()" class="px-4 py-2 rounded-lg border border-[#E5DDD0] text-xs font-serif font-semibold text-[#8C827A] hover:bg-[#FAF6EF] transition">Cancel</button>
        <button type="button" onclick="confirmDeleteSession()" class="px-5 py-2 rounded-lg bg-[#7A2E38] hover:bg-[#66242D] text-[#FAF6EF] text-xs font-serif font-semibold shadow-xs transition">Confirm Delete</button>
      </div>
    </div>
  `;
  return modal;
}

function closeDeleteSessionModal() {
  const modal = document.getElementById('sessionDeleteModal');
  if (modal) modal.classList.add('hidden');
}

async function confirmDeleteSession() {
  const id = document.getElementById('deleteSessionId').value;
  const keep = document.querySelector('input[name="deleteOption"]:checked').value === 'keep';

  if (!id) return;

  try {
    const res = await fetch(`/api/sessions/${id}?keepDocuments=${keep}`, {
      method: 'DELETE',
      headers: getAuthHeader()
    });

    if (res.ok) {
      closeDeleteSessionModal();
      if (typeof window.refreshActiveSessionGrid === 'function') {
        window.refreshActiveSessionGrid();
      }
    } else {
      const err = await res.json();
      alert(err.error || 'Failed to delete session.');
    }
  } catch (err) {
    console.error('Delete session error:', err);
  }
}
