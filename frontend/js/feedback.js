/* KnowledgeAI Feedback Controller JS - Editorial Theme */

document.addEventListener('DOMContentLoaded', async () => {
  const token = checkAuth();
  if (!token) return;

  setupUserInfo();
  setupStarRating();
  setupFormSubmit();
  await loadMyFeedback();
});

function setupUserInfo() {
  const user = JSON.parse(localStorage.getItem('kai_user') || '{}');
  const emailEl = document.getElementById('userHeaderEmail');
  const avatarEl = document.getElementById('userHeaderAvatar');

  if (user.email && emailEl) emailEl.textContent = user.email;
  if (user.email && avatarEl) avatarEl.textContent = user.email.charAt(0).toUpperCase();
}

let currentRatingValue = 5;

function setFeedbackRating(val) {
  currentRatingValue = parseInt(val, 10) || 5;
  const ratingInput = document.getElementById('selectedRating');
  if (ratingInput) ratingInput.value = currentRatingValue;

  const labels = {
    1: '1 / 5 Stars (Poor)',
    2: '2 / 5 Stars (Fair)',
    3: '3 / 5 Stars (Good)',
    4: '4 / 5 Stars (Very Good)',
    5: '5 / 5 Stars (Excellent)'
  };

  const ratingLabel = document.getElementById('ratingLabel');
  if (ratingLabel) ratingLabel.textContent = labels[currentRatingValue] || `${currentRatingValue} Stars`;

  for (let i = 1; i <= 5; i++) {
    const starEl = document.getElementById(`star-${i}`);
    if (starEl) {
      if (i <= currentRatingValue) {
        starEl.style.color = '#9C7A3F';
        starEl.textContent = '★';
      } else {
        starEl.style.color = '#D6CBB8';
        starEl.textContent = '☆';
      }
    }
  }
}

function setupStarRating() {
  setFeedbackRating(5);

  const container = document.getElementById('starRatingContainer');
  for (let i = 1; i <= 5; i++) {
    const starEl = document.getElementById(`star-${i}`);
    if (starEl) {
      starEl.addEventListener('mouseenter', () => {
        for (let j = 1; j <= 5; j++) {
          const s = document.getElementById(`star-${j}`);
          if (s) {
            s.style.color = j <= i ? '#9C7A3F' : '#D6CBB8';
            s.textContent = j <= i ? '★' : '☆';
          }
        }
      });
    }
  }

  if (container) {
    container.addEventListener('mouseleave', () => {
      setFeedbackRating(currentRatingValue);
    });
  }
}

function setupFormSubmit() {
  const form = document.getElementById('feedbackForm');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const category = document.getElementById('feedbackCategory').value;
    const rating = parseInt(document.getElementById('selectedRating').value, 10);
    const message = document.getElementById('feedbackMessage').value.trim();
    const submitBtn = document.getElementById('submitFeedbackBtn');

    if (!message) {
      showFeedbackAlert('Please enter your feedback message before submitting.', true);
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting Feedback...';

    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader()
        },
        body: JSON.stringify({ category, rating, message })
      });

      const data = await res.json();

      if (res.ok) {
        showFeedbackAlert(data.message || 'Feedback submitted successfully!', false);
        document.getElementById('feedbackMessage').value = '';
        await loadMyFeedback();
      } else {
        showFeedbackAlert(data.error || 'Failed to submit feedback.', true);
      }
    } catch (err) {
      console.error('Feedback submit error:', err);
      showFeedbackAlert('Unable to connect to KnowledgeAI server.', true);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Submit Feedback to Admin \u2192';
    }
  });
}

async function loadMyFeedback() {
  const tbody = document.getElementById('myFeedbackTableBody');
  if (!tbody) return;

  try {
    const res = await fetch('/api/feedback/mine', { headers: getAuthHeader() });
    if (!res.ok) throw new Error('Failed to load history');
    const feedbacks = await res.json();

    if (!feedbacks || feedbacks.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4" class="py-6 text-center text-[#8C827A]">You haven't submitted any feedback yet.</td></tr>`;
      return;
    }

    tbody.innerHTML = feedbacks.map(f => {
      const stars = '★'.repeat(f.rating) + '☆'.repeat(5 - f.rating);
      return `
        <tr class="hover:bg-[#FAF6EF]/60 transition-colors">
          <td class="py-3 px-4 font-mono text-[#8C827A] text-[11px] whitespace-nowrap">
            ${new Date(f.created_at).toLocaleDateString()}
          </td>
          <td class="py-3 px-4">
            <span class="px-2 py-0.5 bg-[#9C7A3F]/10 text-[#9C7A3F] border border-[#9C7A3F]/20 text-[10px] font-serif font-bold rounded">
              ${escapeHtml(f.category)}
            </span>
          </td>
          <td class="py-3 px-4 text-[#9C7A3F] font-bold">
            ${stars} (${f.rating}/5)
          </td>
          <td class="py-3 px-4 text-[#221B17] leading-relaxed">
            ${escapeHtml(f.message)}
          </td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="4" class="py-6 text-center text-[#8B2E28]">Failed to load feedback history.</td></tr>`;
  }
}

function showFeedbackAlert(msg, isError = true) {
  const box = document.getElementById('alertBox');
  const msgEl = document.getElementById('alertMessage');
  if (box && msgEl) {
    msgEl.textContent = msg;
    box.className = isError
      ? 'p-4 rounded-md border text-xs font-sans flex items-center gap-2 bg-[#FDF2F1] border-[#F5D5D3] text-[#8B2E28]'
      : 'p-4 rounded-md border text-xs font-serif flex items-center gap-2 bg-[#FAF6EF] border-[#9C7A3F]/40 text-[#9C7A3F]';
    box.classList.remove('hidden');
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
