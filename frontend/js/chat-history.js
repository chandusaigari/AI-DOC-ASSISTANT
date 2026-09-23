/* KnowledgeAI Chat History JS - Private Bank & Law Firm Editorial Theme */

document.addEventListener('DOMContentLoaded', async () => {
  const token = checkAuth();
  if (!token) return;

  await loadHistory();
});

async function loadHistory() {
  const container = document.getElementById('historyGroupsContainer');
  if (!container) return;

  try {
    const res = await fetch('/api/chat/history', { headers: getAuthHeader() });
    if (!res.ok) throw new Error('Failed to load history');
    const items = await res.json();

    const chatIconSvg = `<svg class="w-6 h-6 stroke-current fill-none" viewBox="0 0 24 24" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`;
    const chatSmallSvg = `<svg class="w-4 h-4 stroke-[#7A2E38] fill-none shrink-0" viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`;
    const docIconSvg = `<svg class="w-3.5 h-3.5 stroke-current fill-none shrink-0" viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg>`;

    if (!items || items.length === 0) {
      container.innerHTML = `
        <div class="kai-card p-12 text-center text-[#8C827A] text-sm bg-white rounded-lg border border-[#E5DDD0]">
          <div class="w-10 h-10 mx-auto mb-2 text-[#9C7A3F] flex items-center justify-center">
            ${chatIconSvg}
          </div>
          <p class="font-serif font-semibold text-[#221B17]">No chat history recorded yet.</p>
          <p class="text-xs text-[#8C827A] mt-1">Ask questions in the AI Assistant to save session records here.</p>
          <div class="mt-4">
            <a href="assistant.html" class="btn-primary text-xs py-2 px-4 bg-[#7A2E38] hover:bg-[#5A2129]">Open AI Assistant &rarr;</a>
          </div>
        </div>
      `;
      return;
    }

    // Group items by date buckets: Today, Yesterday, This Week, Earlier
    const groups = groupItemsByDate(items);

    container.innerHTML = Object.keys(groups).map(groupName => {
      const itemsHtml = groups[groupName].map(item => {
        const targetUrl = item.session_id
          ? `assistant.html?session=${item.session_id}${item.thread_id ? `&thread=${item.thread_id}` : ''}`
          : (item.thread_id ? `assistant.html?thread=${item.thread_id}` : `assistant.html?q=${encodeURIComponent(item.question)}`);

        return `
          <div class="kai-card p-5 bg-white border border-[#E5DDD0] hover:shadow-md transition-all rounded-lg">
            <div class="flex items-start justify-between gap-4 mb-2">
              <h4 class="font-serif font-bold text-[#221B17] text-sm flex items-center gap-2">
                <span class="flex items-center shrink-0">${chatSmallSvg}</span>
                <span>"${escapeHtml(item.question)}"</span>
              </h4>
              <span class="text-[10px] text-[#8C827A] font-mono shrink-0">
                ${new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            <p class="text-xs text-[#4A403A] line-clamp-2 leading-relaxed mb-3 font-sans">
              ${escapeHtml(cleanPreviewText(item.answer))}
            </p>
            <div class="flex items-center justify-between border-t border-[#E5DDD0] pt-3 text-xs">
              <div class="flex items-center gap-1.5 text-[#8C827A]">
                ${docIconSvg} <span>${item.citations ? item.citations.length : 0} source citations</span>
              </div>
              <a href="${targetUrl}" class="btn-primary text-xs py-1.5 px-3 bg-[#7A2E38] hover:bg-[#5A2129] inline-flex items-center gap-1">
                <span>Reopen Session &rarr;</span>
              </a>
            </div>
          </div>
        `;
      }).join('');

      return `
        <div class="space-y-4">
          <h3 class="text-xs font-serif font-bold text-[#8C827A] uppercase tracking-wider px-1">${groupName}</h3>
          <div class="space-y-3">
            ${itemsHtml}
          </div>
        </div>
      `;
    }).join('');

  } catch (err) {
    console.error('Chat history error:', err);
    container.innerHTML = `<div class="kai-card p-6 text-center text-[#8B2E28] text-xs bg-white rounded-lg border border-[#E5DDD0]">Failed to load chat history.</div>`;
  }
}

function cleanPreviewText(text) {
  if (!text) return '';
  let clean = text;

  // 1. Replace fenced code blocks (```...```) with [diagram] if box drawing / diagram characters are present, or strip code blocks
  clean = clean.replace(/```[\s\S]*?```/g, (match) => {
    if (/[┌┐└┘├┤┬┴┼─│┌┐└┘╔╗╚╝╠╣╦╩╬═║]|diagram|box/i.test(match)) {
      return ' [diagram] ';
    }
    return ' ';
  });

  // 2. Strip citation markers like [1], [2], [1, 2]
  clean = clean.replace(/\[\d+(?:\s*,\s*\d+)*\]/g, '');

  // 3. Strip markdown syntax (headers #, bold **, italic *, inline ticks `)
  clean = clean.replace(/#{1,6}\s+/g, '');
  clean = clean.replace(/(\*\*|__)(.*?)\1/g, '$2');
  clean = clean.replace(/(\*|_)(.*?)\1/g, '$2');
  clean = clean.replace(/`([^`]+)`/g, '$1');
  clean = clean.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

  // 4. Strip leftover HTML tags
  clean = clean.replace(/<[^>]*>/g, '');

  // 5. Normalize whitespace (multiple spaces/newlines into single space)
  clean = clean.replace(/\s+/g, ' ').trim();

  // 6. Truncate cleanly to 160 chars
  if (clean.length > 160) {
    clean = clean.substring(0, 157).trim() + '...';
  }

  return clean;
}

function groupItemsByDate(items) {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfYesterday = startOfToday - 86400000;
  const startOfWeek = startOfToday - (6 * 86400000);

  const groups = {
    'Today': [],
    'Yesterday': [],
    'This Week': [],
    'Earlier': []
  };

  items.forEach(item => {
    const t = new Date(item.created_at).getTime();
    if (isNaN(t)) {
      groups['Earlier'].push(item);
    } else if (t >= startOfToday) {
      groups['Today'].push(item);
    } else if (t >= startOfYesterday) {
      groups['Yesterday'].push(item);
    } else if (t >= startOfWeek) {
      groups['This Week'].push(item);
    } else {
      groups['Earlier'].push(item);
    }
  });

  // Remove empty buckets
  Object.keys(groups).forEach(key => {
    if (groups[key].length === 0) delete groups[key];
  });

  return groups;
}

async function clearHistory() {
  if (!confirm('Are you sure you want to clear all past AI Assistant chat sessions?')) return;
  try {
    const res = await fetch('/api/chat/history', {
      method: 'DELETE',
      headers: getAuthHeader()
    });
    if (res.ok) {
      await loadHistory();
    } else {
      alert('Failed to clear chat history.');
    }
  } catch (err) {
    alert('Error clearing chat history.');
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}
