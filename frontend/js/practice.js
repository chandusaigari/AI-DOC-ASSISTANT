/* KnowledgeAI Practice Panel Controller JS - Editorial Theme */

let currentMode = 'mcq';
let currentDocId = 'all';
let mcqQuestionsList = [];
let currentMcqIndex = 0;
let scoreCorrect = 0;
let scoreTotal = 0;
let currentVivaData = null;

document.addEventListener('DOMContentLoaded', async () => {
  const token = checkAuth();
  if (!token) return;

  setupUserInfo();
  await loadPracticeDocuments();
});

function setupUserInfo() {
  const user = JSON.parse(localStorage.getItem('kai_user') || '{}');
  const emailEl = document.getElementById('userHeaderEmail');
  const avatarEl = document.getElementById('userHeaderAvatar');

  if (user.email && emailEl) emailEl.textContent = user.email;
  if (user.email && avatarEl) avatarEl.textContent = user.email.charAt(0).toUpperCase();
}

async function loadPracticeDocuments() {
  const selectEl = document.getElementById('practiceDocSelect');
  if (!selectEl) return;

  try {
    const res = await fetch('/api/documents', { headers: getAuthHeader() });
    if (res.ok) {
      const docs = await res.json();
      selectEl.innerHTML = `<option value="all">All Uploaded Documents (Corpus-wide)</option>`;
      docs.forEach(doc => {
        selectEl.innerHTML += `<option value="${doc.id}">${escapeHtml(doc.title)} (${doc.file_type.toUpperCase()})</option>`;
      });
    }
  } catch (err) {
    console.error('Error loading practice documents:', err);
  }
}

async function startPracticeMode(mode) {
  currentMode = mode;
  const selectEl = document.getElementById('practiceDocSelect');
  currentDocId = selectEl ? selectEl.value : 'all';

  const selectorCards = document.getElementById('modeSelectorCards');
  const practiceView = document.getElementById('practiceViewContainer');
  if (selectorCards) selectorCards.classList.add('hidden');
  if (practiceView) practiceView.classList.remove('hidden');

  const modeBadge = document.getElementById('practiceModeBadge');
  const mcqSection = document.getElementById('mcqPracticeSection');
  const vivaSection = document.getElementById('vivaPracticeSection');

  if (mode === 'mcq') {
    if (modeBadge) modeBadge.textContent = 'Objective MCQ Quiz Mode';
    if (mcqSection) mcqSection.classList.remove('hidden');
    if (vivaSection) vivaSection.classList.add('hidden');
    await loadMcqSession();
  } else {
    if (modeBadge) modeBadge.textContent = 'Viva Voice Oral Exam Mode';
    if (mcqSection) mcqSection.classList.add('hidden');
    if (vivaSection) vivaSection.classList.remove('hidden');
    await loadVivaQuestion();
  }
}

function resetPracticeSelection() {
  const selectorCards = document.getElementById('modeSelectorCards');
  const practiceView = document.getElementById('practiceViewContainer');
  const mcqSection = document.getElementById('mcqPracticeSection');
  const vivaSection = document.getElementById('vivaPracticeSection');

  if (selectorCards) selectorCards.classList.remove('hidden');
  if (practiceView) practiceView.classList.add('hidden');
  if (mcqSection) mcqSection.classList.add('hidden');
  if (vivaSection) vivaSection.classList.add('hidden');
}

async function loadMcqSession() {
  scoreCorrect = 0;
  scoreTotal = 0;
  currentMcqIndex = 0;
  updateScoreBadge();

  const quizCard = document.getElementById('mcqQuizCard');
  const summaryCard = document.getElementById('mcqSummaryCard');
  if (quizCard) quizCard.classList.remove('hidden');
  if (summaryCard) summaryCard.classList.add('hidden');

  const qText = document.getElementById('mcqQuestionText');
  if (qText) qText.textContent = 'Generating document-based objective MCQs...';

  try {
    const res = await fetch('/api/practice/generate-mcq', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify({ documentId: currentDocId, count: 5 })
    });

    const data = await res.json();
    if (res.ok && data.questions && data.questions.length > 0) {
      mcqQuestionsList = data.questions;
      renderCurrentMcq();
    } else {
      if (qText) qText.textContent = data.error || 'Failed to generate practice MCQs.';
    }
  } catch (err) {
    console.error('MCQ Load Error:', err);
    if (qText) qText.textContent = 'Error connecting to KnowledgeAI server.';
  }
}

function renderCurrentMcq() {
  if (currentMcqIndex >= mcqQuestionsList.length) {
    renderMcqSummary();
    return;
  }

  const q = mcqQuestionsList[currentMcqIndex];
  const counterEl = document.getElementById('mcqCounter');
  const citationEl = document.getElementById('mcqCitationBadge');
  const qText = document.getElementById('mcqQuestionText');

  if (counterEl) counterEl.textContent = `Question ${currentMcqIndex + 1} of ${mcqQuestionsList.length}`;
  if (citationEl) citationEl.textContent = `Source: ${q.citation || 'Uploaded Document'}`;
  if (qText) qText.textContent = q.question;

  const optionsContainer = document.getElementById('mcqOptionsContainer');
  const expCard = document.getElementById('mcqExplanationCard');
  const nextBtn = document.getElementById('nextMcqBtn');

  if (expCard) expCard.classList.add('hidden');
  if (nextBtn) nextBtn.classList.add('hidden');

  if (optionsContainer) {
    const optionLabels = ['A', 'B', 'C', 'D'];
    optionsContainer.innerHTML = (q.options || []).map((opt, idx) => `
      <button id="mcqOpt-${idx}" onclick="selectMcqOption(${idx})" 
        class="w-full text-left p-4 rounded-md border-2 border-[#E5DDD0] bg-[#FAF6EF]/60 hover:bg-white hover:border-[#9C7A3F] transition-all flex items-start gap-3 cursor-pointer group">
        <span class="w-6 h-6 rounded bg-[#9C7A3F]/10 text-[#9C7A3F] font-serif font-bold text-xs flex items-center justify-center shrink-0 group-hover:bg-[#9C7A3F] group-hover:text-white transition-colors">${optionLabels[idx]}</span>
        <span class="text-xs text-[#221B17] font-medium leading-relaxed flex-1">${escapeHtml(opt)}</span>
        <span id="optBadge-${idx}" class="text-xs font-bold shrink-0 hidden"></span>
      </button>
    `).join('');
  }
}

function selectMcqOption(selectedIndex) {
  const q = mcqQuestionsList[currentMcqIndex];
  const correctIdx = q.correctAnswerIndex !== undefined ? q.correctAnswerIndex : 0;
  const isCorrect = selectedIndex === correctIdx;

  scoreTotal++;
  if (isCorrect) scoreCorrect++;
  updateScoreBadge();

  // Disable all options
  for (let i = 0; i < (q.options || []).length; i++) {
    const btn = document.getElementById(`mcqOpt-${i}`);
    if (btn) btn.onclick = null;
  }

  const selectedBtn = document.getElementById(`mcqOpt-${selectedIndex}`);
  const selectedBadge = document.getElementById(`optBadge-${selectedIndex}`);
  const correctBtn = document.getElementById(`mcqOpt-${correctIdx}`);
  const correctBadge = document.getElementById(`optBadge-${correctIdx}`);

  if (isCorrect) {
    if (selectedBtn) {
      selectedBtn.className = 'w-full text-left p-4 rounded-md border-2 border-emerald-600 bg-emerald-50 text-emerald-950 flex items-start gap-3 shadow-sm';
    }
    if (selectedBadge) {
      selectedBadge.textContent = '✓ Correct Answer';
      selectedBadge.className = 'text-xs font-serif font-bold px-2 py-0.5 rounded bg-emerald-600 text-white shrink-0';
      selectedBadge.classList.remove('hidden');
    }
  } else {
    if (selectedBtn) {
      selectedBtn.className = 'w-full text-left p-4 rounded-md border-2 border-rose-600 bg-rose-50 text-rose-950 flex items-start gap-3 shadow-sm';
    }
    if (selectedBadge) {
      selectedBadge.textContent = '✗ Incorrect Choice';
      selectedBadge.className = 'text-xs font-serif font-bold px-2 py-0.5 rounded bg-rose-600 text-white shrink-0';
      selectedBadge.classList.remove('hidden');
    }

    if (correctBtn) {
      correctBtn.className = 'w-full text-left p-4 rounded-md border-2 border-emerald-600 bg-emerald-50/80 text-emerald-950 flex items-start gap-3 shadow-sm animate-pulse';
    }
    if (correctBadge) {
      correctBadge.textContent = '✓ True Correct Answer';
      correctBadge.className = 'text-xs font-serif font-bold px-2 py-0.5 rounded bg-emerald-600 text-white shrink-0';
      correctBadge.classList.remove('hidden');
    }
  }

  // Show Explanation Card
  const expCard = document.getElementById('mcqExplanationCard');
  const resTitle = document.getElementById('mcqResultTitle');
  const expText = document.getElementById('mcqExplanationText');

  if (expCard) {
    expCard.className = isCorrect
      ? 'p-4 rounded-md border-2 border-emerald-300 bg-emerald-50/60 text-xs leading-relaxed space-y-2'
      : 'p-4 rounded-md border-2 border-rose-300 bg-rose-50/60 text-xs leading-relaxed space-y-2';
    expCard.classList.remove('hidden');
  }

  if (resTitle) {
    resTitle.innerHTML = isCorrect
      ? `<span class="text-emerald-800 font-bold">✓ Excellent! Correct Answer.</span>`
      : `<span class="text-rose-800 font-bold">✗ Incorrect. Review the official document explanation below:</span>`;
  }

  if (expText) expText.textContent = q.explanation || `Refer to ${q.citation || 'document text'} for details.`;

  const nextBtn = document.getElementById('nextMcqBtn');
  if (nextBtn) nextBtn.classList.remove('hidden');
}

function nextMcqQuestion() {
  currentMcqIndex++;
  renderCurrentMcq();
}

function renderMcqSummary() {
  const pct = Math.round((scoreCorrect / (scoreTotal || 1)) * 100);

  const quizCard = document.getElementById('mcqQuizCard');
  const summaryCard = document.getElementById('mcqSummaryCard');
  const scoreText = document.getElementById('mcqSummaryScoreText');
  const adviceText = document.getElementById('mcqSummaryAdviceText');

  if (quizCard) quizCard.classList.add('hidden');
  if (summaryCard) summaryCard.classList.remove('hidden');
  if (scoreText) scoreText.textContent = `${scoreCorrect} / ${scoreTotal} Correct (${pct}%)`;
  if (adviceText) {
    adviceText.textContent = pct >= 80 
      ? 'Outstanding comprehension! You have mastered the key facts in this document.' 
      : 'Good practice attempt! Review document passages to improve accuracy.';
  }
}

async function loadVivaQuestion() {
  const qText = document.getElementById('vivaQuestionText');
  const inputEl = document.getElementById('vivaAnswerInput');
  const evalCard = document.getElementById('vivaEvaluationCard');

  if (qText) qText.textContent = 'Generating conceptual Viva question from document...';
  if (inputEl) inputEl.value = '';
  if (evalCard) evalCard.classList.add('hidden');

  try {
    const res = await fetch('/api/practice/generate-viva', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify({ documentId: currentDocId })
    });

    const data = await res.json();
    if (res.ok && data.question) {
      currentVivaData = data;
      const topicBadge = document.getElementById('vivaTopicBadge');
      const citationBadge = document.getElementById('vivaCitationBadge');

      if (qText) qText.textContent = data.question;
      if (topicBadge) topicBadge.textContent = `Topic: ${data.topic || 'Document Concepts'}`;
      if (citationBadge) citationBadge.textContent = `Source: ${data.documentTitle} (${data.citation})`;
    } else {
      if (qText) qText.textContent = data.error || 'Failed to generate Viva question.';
    }
  } catch (err) {
    console.error('Viva Load Error:', err);
    if (qText) qText.textContent = 'Error connecting to KnowledgeAI server.';
  }
}

async function submitVivaAnswer() {
  const inputEl = document.getElementById('vivaAnswerInput');
  const submitBtn = document.getElementById('submitVivaBtn');
  const userAnswer = inputEl ? inputEl.value.trim() : '';

  if (!userAnswer) {
    alert('Please type your response to the examiner\'s Viva question before submitting.');
    return;
  }

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Examiner Reviewing Answer...';
  }

  try {
    const res = await fetch('/api/practice/evaluate-viva', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify({
        question: currentVivaData ? currentVivaData.question : '',
        userAnswer,
        documentId: currentDocId
      })
    });

    const data = await res.json();
    if (res.ok && data.score !== undefined) {
      const scoreVal = document.getElementById('vivaScoreVal');
      const ratingBadge = document.getElementById('vivaRatingBadge');
      const feedbackText = document.getElementById('vivaFeedbackText');
      const strengthsText = document.getElementById('vivaStrengthsText');
      const missedText = document.getElementById('vivaMissedText');
      const modelText = document.getElementById('vivaModelAnswerText');
      const evalCard = document.getElementById('vivaEvaluationCard');

      if (scoreVal) scoreVal.textContent = `${data.score}/10`;
      if (ratingBadge) ratingBadge.textContent = data.rating || 'Satisfactory';
      if (feedbackText) feedbackText.textContent = data.feedback || 'Answer reviewed.';
      if (strengthsText) strengthsText.textContent = data.strengths || 'Good conceptual effort.';
      if (missedText) missedText.textContent = data.missedPoints || 'Include more specific technical terms.';
      if (modelText) modelText.textContent = data.modelAnswer || 'Refer to document source.';

      if (evalCard) evalCard.classList.remove('hidden');
    } else {
      alert(data.error || 'Failed to evaluate Viva response.');
    }
  } catch (err) {
    console.error('Viva Evaluate Error:', err);
    alert('Error submitting Viva answer to server.');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Submit Response to Examiner \u2192';
    }
  }
}

function nextVivaQuestion() {
  loadVivaQuestion();
}

function updateScoreBadge() {
  const scoreBadge = document.getElementById('scoreTrackerBadge');
  if (scoreBadge) {
    const pct = scoreTotal > 0 ? Math.round((scoreCorrect / scoreTotal) * 100) : 0;
    scoreBadge.textContent = `Score: ${scoreCorrect}/${scoreTotal} (${pct}%)`;
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
