/* KnowledgeAI API Config */

const API_BASE = '/api';

function getAuthHeader() {
  const token = localStorage.getItem('kai_token');
  return token ? { 'Authorization': `Bearer ${token}` } : {};
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

if (typeof window !== 'undefined') {
  window.API_BASE = API_BASE;
  window.getAuthHeader = window.getAuthHeader || getAuthHeader;
  window.checkAuth = window.checkAuth || checkAuth;
  window.logout = window.logout || logout;
}
