/* KnowledgeAI Reusable Left Sidebar JS Component - Dark Charcoal & Brass/Gold Editorial Theme */

document.addEventListener('DOMContentLoaded', () => {
  renderSidebar();
  loadSidebarStorageUsage();
});

function renderSidebar() {
  const root = document.getElementById('sidebar-root') || document.getElementById('sidebar-container');
  if (!root) return;

  const isCollapsed = localStorage.getItem('kai_sidebar_collapsed') === 'true';
  const dataActive = (root.getAttribute('data-active') || '').toLowerCase().trim();
  const currentPath = window.location.pathname.toLowerCase();

  function isActive(key, href) {
    if (dataActive) {
      if (key === dataActive) return true;
      if (dataActive === 'dashboard' && key === 'dashboard') return true;
      if (dataActive === 'home' && key === 'dashboard') return true;
      if ((dataActive === 'chats' || dataActive === 'history' || dataActive === 'recent chats') && key === 'chats') return true;
    }
    const page = href.split('.')[0];
    return currentPath.includes(page);
  }

  const user = JSON.parse(localStorage.getItem('kai_user') || '{}');
  const isAdmin = user && user.role === 'admin';

  const menuItems = [
    { key: 'dashboard', label: 'Dashboard', icon: `<svg class="w-4 h-4 fill-current shrink-0" viewBox="0 0 24 24"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>`, href: 'home.html' },
    { key: 'documents', label: 'Documents', icon: `<svg class="w-4 h-4 stroke-current fill-none shrink-0" viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg>`, href: 'documents.html' },
    { key: 'search', label: 'Search Knowledge', icon: `<svg class="w-4 h-4 stroke-current fill-none shrink-0" viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`, href: 'search.html' },
    { key: 'assistant', label: 'AI Assistant', icon: `<svg class="w-4 h-4 stroke-current fill-none shrink-0" viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="10" rx="3"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4"/><line x1="8" y1="15" x2="8" y2="15.01"/><line x1="16" y1="15" x2="16" y2="15.01"/><line x1="9" y1="18" x2="15" y2="18"/></svg>`, href: 'assistant.html' },
    { key: 'practice', label: 'Practice Panel', icon: `<svg class="w-4 h-4 stroke-current fill-none shrink-0" viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>`, href: 'practice.html' },
    { key: 'chats', label: 'Recent Chats', icon: `<svg class="w-4 h-4 stroke-current fill-none shrink-0" viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`, href: 'chat-history.html' },
    { key: 'favorites', label: 'Favorites', icon: `<svg class="w-4 h-4 fill-current stroke-current shrink-0" viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`, href: 'favorites.html' },
    { key: 'feedback', label: 'Submit Feedback', icon: `<svg class="w-4 h-4 stroke-current fill-none shrink-0" viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>`, href: 'feedback.html' }
  ];

  if (isAdmin) {
    menuItems.push({
      key: 'admin',
      label: 'Admin Panel',
      icon: `<svg class="w-4 h-4 stroke-current fill-none shrink-0" viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
      href: 'admin.html'
    });
  }

  const isSettingsActive = isActive('settings', 'settings.html');
  const sidebarWidthClass = isCollapsed ? 'w-20' : 'w-64';

  root.className = `${sidebarWidthClass} bg-[#1C1613] border-r border-[#332A24] flex flex-col justify-between hidden md:flex shrink-0 h-screen sticky top-0 z-40 text-[#FAF6EF] relative transition-all duration-300 ease-in-out`;
  
  root.innerHTML = `
    <!-- SVG Gooey Filter Definition -->
    <svg class="absolute w-0 h-0 overflow-hidden pointer-events-none" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="gooey-filter">
          <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur" />
          <feColorMatrix in="blur" type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -8" result="goo" />
          <feBlend in="SourceGraphic" in2="goo" />
        </filter>
      </defs>
    </svg>

    <!-- Floating Hide / Open Sidebar Toggle Button -->
    <button onclick="toggleSidebarCollapse()" 
      class="absolute -right-3.5 top-7 w-7 h-7 rounded-full bg-[#1C1613] border border-[#332A24] text-[#D6CBB8] hover:text-white hover:bg-[#2A221E] flex items-center justify-center text-[10px] shadow-sm z-50 transition-all hover:scale-110 active:scale-95 cursor-pointer" 
      title="${isCollapsed ? 'Open Sidebar (Expand)' : 'Hide Sidebar (Collapse)'}">
      <span>${isCollapsed ? '▶' : '◀'}</span>
    </button>

    <div class="flex flex-col h-full justify-between z-10">
      <div>
        <!-- Logo Header -->
        <div class="p-5 border-b border-[#332A24] flex items-center ${isCollapsed ? 'justify-center' : 'justify-start'}">
          <a href="home.html" class="flex items-center gap-3 group" title="KnowledgeAI">
            <div class="brand-logo-badge shadow-md">K</div>
            <span class="${isCollapsed ? 'hidden' : 'block'} text-xl font-serif font-bold tracking-tight text-[#FAF6EF] group-hover:text-[#9C7A3F] transition-colors">Knowledge<span class="text-[#9C7A3F]">AI</span></span>
          </a>
        </div>

        <!-- Quick Upload Button -->
        <div class="p-3 pb-2">
          <a href="documents.html?upload=1" 
            class="w-full bg-[#7A2E38] hover:bg-[#5A2129] text-[#FAF6EF] py-2.5 ${isCollapsed ? 'px-0 justify-center' : 'px-4 justify-center'} text-xs font-semibold rounded-md flex items-center gap-2 shadow-sm transition-all border border-white/10"
            title="Upload Document">
            <span class="text-base font-bold">+</span>
            <span class="${isCollapsed ? 'hidden' : 'inline'}">Upload Document</span>
          </a>
        </div>

        <!-- SVG Gooey Nav Menu Container -->
        <nav class="p-2 space-y-1.5 gooey-menu-container">
          ${menuItems.map(item => {
            const active = isActive(item.key, item.href);
            const activeClasses = active
              ? 'active text-[#9C7A3F] font-semibold bg-[rgba(156,122,63,0.12)] border-l-3 border-l-[#9C7A3F]'
              : 'text-[#D6CBB8] hover:text-white hover:bg-[#2A221E] font-medium border-l-3 border-l-transparent';
            return `
              <a href="${item.href}" 
                class="gooey-nav-link flex items-center ${isCollapsed ? 'justify-center px-0' : 'gap-3 px-3.5'} py-2.5 rounded-md ${activeClasses} text-xs transition-all"
                title="${item.label}">
                <span class="nav-icon flex items-center justify-center shrink-0">${item.icon}</span>
                <span class="${isCollapsed ? 'hidden' : 'inline'}">${item.label}</span>
              </a>
            `;
          }).join('')}
        </nav>
      </div>

      <!-- Bottom Area -->
      <div class="p-3 border-t border-[#332A24] space-y-3 bg-[#1C1613]">
        <!-- Storage Usage Indicator -->
        <div class="p-2.5 bg-[#241C18] rounded-md border border-[#332A24] shadow-sm space-y-1.5">
          <div class="flex justify-between items-center text-[11px] font-semibold text-[#D6CBB8] ${isCollapsed ? 'justify-center' : ''}">
            <span class="${isCollapsed ? 'hidden' : 'inline'}">Storage Usage</span>
            <span id="sidebarStorageText" class="text-[#8C827A] font-mono ${isCollapsed ? 'text-[9px]' : ''}">0 MB</span>
          </div>
          <div class="w-full bg-[#1C1613] rounded-full h-1.5 overflow-hidden">
            <div id="sidebarProgressBar" class="bg-[#9C7A3F] h-full transition-all duration-500" style="width: 2%;"></div>
          </div>
        </div>

        <hr class="border-[#332A24]">

        <!-- Settings Link -->
        <a href="settings.html" 
          class="flex items-center ${isCollapsed ? 'justify-center px-0' : 'gap-3 px-3'} py-2 rounded-md text-xs font-medium ${isSettingsActive ? 'bg-[rgba(156,122,63,0.12)] text-[#9C7A3F] font-semibold border-l-3 border-l-[#9C7A3F]' : 'text-[#D6CBB8] hover:bg-[#2A221E] hover:text-white border-l-3 border-l-transparent'} transition-all active:scale-[0.98]"
          title="Settings">
          <span class="flex items-center justify-center shrink-0"><svg class="w-4 h-4 stroke-current fill-none shrink-0" viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg></span>
          <span class="${isCollapsed ? 'hidden' : 'inline'}">Settings</span>
        </a>

        <!-- Logout Link -->
        <a href="#" onclick="logout(); return false;" 
          class="flex items-center ${isCollapsed ? 'justify-center px-0' : 'gap-3 px-3'} py-2 rounded-md text-xs font-medium text-[#D6CBB8] hover:bg-[#8B2E28]/20 hover:text-red-300 border-l-3 border-l-transparent transition-all active:scale-[0.98]"
          title="Logout">
          <span class="flex items-center justify-center shrink-0"><svg class="w-4 h-4 stroke-current fill-none shrink-0" viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg></span>
          <span class="${isCollapsed ? 'hidden' : 'inline'}">Logout</span>
        </a>
      </div>
    </div>
  `;
}

function toggleSidebarCollapse() {
  const currentlyCollapsed = localStorage.getItem('kai_sidebar_collapsed') === 'true';
  localStorage.setItem('kai_sidebar_collapsed', currentlyCollapsed ? 'false' : 'true');
  renderSidebar();
  loadSidebarStorageUsage();
}

async function loadSidebarStorageUsage() {
  try {
    const token = localStorage.getItem('kai_token');
    if (!token) return;

    const res = await fetch('/api/dashboard/stats', {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (res.ok) {
      const data = await res.json();
      const totalBytes = data.totalBytes || 0;
      const usedMB = (totalBytes / (1024 * 1024)).toFixed(1);
      const quotaMB = 500;
      const percentage = Math.min(100, Math.max(3, Math.round((usedMB / quotaMB) * 100)));

      const textEl = document.getElementById('sidebarStorageText');
      const barEl = document.getElementById('sidebarProgressBar');

      const isCollapsed = localStorage.getItem('kai_sidebar_collapsed') === 'true';
      if (textEl) {
        textEl.textContent = isCollapsed ? `${usedMB}MB` : `${usedMB} MB / ${quotaMB} MB`;
      }
      if (barEl) barEl.style.width = `${percentage}%`;
    }
  } catch (err) {
    console.error('Error fetching sidebar storage stats:', err);
  }
}

function logout() {
  localStorage.removeItem('kai_token');
  localStorage.removeItem('kai_user');
  window.location.href = 'index.html';
}
