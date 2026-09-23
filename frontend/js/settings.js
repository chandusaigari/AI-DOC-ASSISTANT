/* KnowledgeAI Settings JS - Private Bank & Law Firm Editorial Theme */

document.addEventListener('DOMContentLoaded', async () => {
  const token = checkAuth();
  if (!token) return;

  await loadSettings();
  loadAiPreferences();
  setupPasswordForm();
});

async function loadSettings() {
  try {
    const res = await fetch('/api/settings', { headers: getAuthHeader() });
    if (!res.ok) throw new Error('Failed to load settings');
    const data = await res.json();

    const emailInput = document.getElementById('profileEmail');
    const nameInput = document.getElementById('profileFullName');
    const apiKeyInput = document.getElementById('grokApiKey');

    if (emailInput) emailInput.value = data.profile?.email || '';
    if (nameInput) nameInput.value = data.profile?.fullName || '';
    if (apiKeyInput && data.grokApiKey) apiKeyInput.value = data.grokApiKey;
  } catch (err) {
    showSettingsAlert('Failed to retrieve account details.', true);
  }
}

function loadAiPreferences() {
  const showSources = localStorage.getItem('kai_pref_show_sources') !== 'false';
  const strictDocs = localStorage.getItem('kai_pref_strict_docs') !== 'false';

  const showSourcesEl = document.getElementById('prefShowSources');
  const strictDocsEl = document.getElementById('prefStrictDocs');

  if (showSourcesEl) showSourcesEl.checked = showSources;
  if (strictDocsEl) strictDocsEl.checked = strictDocs;
}

async function saveAiPreferences() {
  const showSources = document.getElementById('prefShowSources').checked;
  const strictDocs = document.getElementById('prefStrictDocs').checked;
  const grokApiKey = document.getElementById('grokApiKey')?.value.trim() || '';

  localStorage.setItem('kai_pref_show_sources', showSources ? 'true' : 'false');
  localStorage.setItem('kai_pref_strict_docs', strictDocs ? 'true' : 'false');

  try {
    const res = await fetch('/api/settings', {
      method: 'PUT',
      headers: {
        ...getAuthHeader(),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ grokApiKey })
    });
    if (res.ok) {
      showSettingsAlert('AI Assistant preferences & Grok API Key saved successfully!', false);
    } else {
      const data = await res.json();
      showSettingsAlert(data.error || 'Failed to save settings.', true);
    }
  } catch (err) {
    showSettingsAlert('Error saving AI Assistant preferences.', true);
  }
}

async function reindexSearchIndex() {
  const btn = document.getElementById('reindexBtn');
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Rebuilding Search Index...';
  }

  try {
    const res = await fetch('/api/documents/reindex', {
      method: 'POST',
      headers: getAuthHeader()
    });
    const data = await res.json();
    if (res.ok && data.success) {
      showSettingsAlert(data.message || 'Search index successfully rebuilt.', false);
    } else {
      showSettingsAlert(data.error || 'Failed to rebuild search index.', true);
    }
  } catch (err) {
    showSettingsAlert('Network error while rebuilding search index.', true);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Rebuild Search Index';
    }
  }
}

function togglePasswordForm() {
  const container = document.getElementById('passwordFormContainer');
  if (container) {
    container.classList.toggle('hidden');
  }
}

async function saveProfile() {
  const fullName = document.getElementById('profileFullName').value.trim();
  const email = document.getElementById('profileEmail').value.trim();

  try {
    const res = await fetch('/api/settings', {
      method: 'PUT',
      headers: {
        ...getAuthHeader(),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ fullName, email })
    });
    const data = await res.json();
    if (res.ok) {
      showSettingsAlert('Profile details updated successfully!', false);
      const storedUser = JSON.parse(localStorage.getItem('kai_user') || '{}');
      storedUser.fullName = fullName;
      localStorage.setItem('kai_user', JSON.stringify(storedUser));
    } else {
      showSettingsAlert(data.error || 'Failed to update profile.', true);
    }
  } catch (err) {
    showSettingsAlert('Error updating profile.', true);
  }
}

function setupPasswordForm() {
  const passwordForm = document.getElementById('passwordForm');
  if (!passwordForm) return;

  passwordForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmNewPassword = document.getElementById('confirmNewPassword').value;

    if (newPassword !== confirmNewPassword) {
      showSettingsAlert('New passwords do not match.', true);
      return;
    }

    if (newPassword.length < 6) {
      showSettingsAlert('New password must be at least 6 characters long.', true);
      return;
    }

    try {
      const res = await fetch('/api/settings/password', {
        method: 'POST',
        headers: {
          ...getAuthHeader(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ currentPassword, newPassword })
      });
      const data = await res.json();
      if (res.ok) {
        showSettingsAlert('Password changed successfully!', false);
        document.getElementById('currentPassword').value = '';
        document.getElementById('newPassword').value = '';
        document.getElementById('confirmNewPassword').value = '';
        togglePasswordForm();
      } else {
        showSettingsAlert(data.error || 'Failed to change password.', true);
      }
    } catch (err) {
      showSettingsAlert('Error changing password.', true);
    }
  });
}

async function confirmDeleteAccount() {
  const confirmed = confirm('Are you sure you want to delete your KnowledgeAI account? All uploaded documents, vector indices, and conversation history will be permanently deleted.');
  if (!confirmed) return;

  try {
    const res = await fetch('/api/settings', {
      method: 'DELETE',
      headers: getAuthHeader()
    });
    if (res.ok) {
      alert('Account deleted.');
      logout();
    } else {
      alert('Failed to delete account.');
    }
  } catch (err) {
    alert('Error deleting account.');
  }
}

function showSettingsAlert(msg, isError = true) {
  const alertEl = document.getElementById('settingsAlert');
  if (!alertEl) return;
  alertEl.textContent = msg;
  alertEl.className = isError
    ? 'p-4 bg-[#FDF2F1] border border-[#F5D5D3] text-[#8B2E28] text-xs font-semibold rounded-md'
    : 'p-4 bg-[#FAF6EF] border border-[#9C7A3F]/30 text-[#9C7A3F] text-xs font-serif font-semibold rounded-md';
  alertEl.classList.remove('hidden');

  setTimeout(() => {
    alertEl.classList.add('hidden');
  }, 4000);
}
