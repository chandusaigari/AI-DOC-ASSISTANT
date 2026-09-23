/* KnowledgeAI Frontend Auth Helper - Private Bank & Law Firm Editorial Theme */

const API_BASE = '/api';

function getAuthHeader() {
  const token = localStorage.getItem('kai_token');
  return token ? { 'Authorization': `Bearer ${token}`, 'x-auth-token': token } : {};
}

function checkAuth() {
  const token = localStorage.getItem('kai_token');
  if (!token) {
    window.location.href = 'login.html';
    return null;
  }
  return token;
}

function logout() {
  localStorage.removeItem('kai_token');
  localStorage.removeItem('kai_user');
  window.location.href = 'index.html';
}

function showAlert(message, isError = true) {
  const box = document.getElementById('alertBox');
  const msg = document.getElementById('alertMessage');
  if (box && msg) {
    msg.textContent = message;
    box.className = isError 
      ? 'mb-5 p-3.5 bg-[#FDF2F1] border border-[#F5D5D3] text-[#8B2E28] text-xs rounded-md flex items-center gap-2'
      : 'mb-5 p-3.5 bg-[#FAF6EF] border border-[#9C7A3F]/30 text-[#9C7A3F] text-xs font-serif rounded-md flex items-center gap-2';
    box.classList.remove('hidden');
  }
}

// Check for Admin authentication requirement in URL
document.addEventListener('DOMContentLoaded', () => {
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.has('admin') || urlParams.get('reason') === 'admin_required') {
    showAlert('🔒 Administrator Authentication Required — Please sign in with your Admin credentials.', true);
  }
});

function handleAdminPortalClick(e) {
  if (e) e.preventDefault();
  const token = localStorage.getItem('kai_token');
  const user = JSON.parse(localStorage.getItem('kai_user') || '{}');

  if (!token) {
    window.location.href = 'login.html?admin=1';
    return;
  }

  if (user && user.role === 'admin') {
    window.location.href = 'admin.html';
  } else {
    alert(`Access Denied.\n\nYou are currently signed in as "${user.email || 'Standard User'}" (Role: ${user.role || 'user'}).\nAdministrator privileges are required to access the Admin Control Center.`);
  }
}

// Login Form Submit Handler
const loginForm = document.getElementById('loginForm');
if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const submitBtn = document.getElementById('submitBtn');

    if (!email || !password) {
      showAlert('Please enter both email address and password.');
      return;
    }

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span>Signing in...</span>';

    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();

      if (res.ok && data.token) {
        localStorage.setItem('kai_token', data.token);
        localStorage.setItem('kai_user', JSON.stringify(data.user));

        // Smart Role-Based Redirection:
        // Admin -> admin.html
        // Standard User -> home.html
        if (data.user && data.user.role === 'admin') {
          window.location.href = 'admin.html';
        } else {
          window.location.href = 'home.html';
        }
      } else {
        showAlert(data.error || 'Invalid email or password.');
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<span>Sign In</span>';
      }
    } catch (err) {
      showAlert('Unable to connect to KnowledgeAI server.');
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<span>Sign In</span>';
    }
  });
}

// Signup Form Submit Handler
const signupForm = document.getElementById('signupForm');
if (signupForm) {
  signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fullNameInput = document.getElementById('fullName');
    const fullName = fullNameInput ? fullNameInput.value.trim() : '';
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    const submitBtn = document.getElementById('submitBtn');

    if (password.length < 6) {
      showAlert('Password must be at least 6 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      showAlert('Passwords do not match. Please re-enter your password.');
      return;
    }

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span>Creating Account...</span>';

    try {
      const res = await fetch(`${API_BASE}/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName, email, password })
      });
      const data = await res.json();

      if (res.ok && data.token) {
        localStorage.setItem('kai_token', data.token);
        localStorage.setItem('kai_user', JSON.stringify(data.user));
        window.location.href = 'home.html';
      } else {
        showAlert(data.error || 'Registration failed.');
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<span>Create Account</span>';
      }
    } catch (err) {
      showAlert('Unable to connect to KnowledgeAI server.');
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<span>Create Account</span>';
    }
  });
}



