const chatBox = document.getElementById('chat-box');
const chatForm = document.getElementById('chat-form');
const queryInput = document.getElementById('query-input');
const sendBtn = document.getElementById('send-btn');
const systemStats = document.getElementById('system-stats');

async function loadHealth() {
  try {
    const res = await fetch('/api/health');
    const data = await res.json();
    if (data.status === 'ok') {
      systemStats.textContent = `⚡ Pinecone: ${data.pineconeIndex} (${data.namespace}) | Model: ${data.model}`;
    }
  } catch (err) {
    systemStats.textContent = '⚠️ API Offline';
  }
}
loadHealth();

document.querySelectorAll('.chip').forEach(chip => {
  chip.addEventListener('click', () => {
    queryInput.value = chip.dataset.query;
    chatForm.dispatchEvent(new Event('submit'));
  });
});

chatForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (sendBtn.disabled) return;
  const query = queryInput.value.trim();
  if (!query) return;

  appendMessage('user', query);
  queryInput.value = '';
  sendBtn.disabled = true;

  const typingId = appendTypingIndicator();

  try {
    const res = await fetch('/api/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: query }),
    });

    const data = await res.json();
    removeTypingIndicator(typingId);

    if (res.ok) {
      appendMessage('assistant', data.answer, data.sources);
    } else {
      appendMessage('assistant', `⚠️ Error: ${data.error || data.details || 'Failed to get response.'}`);
    }
  } catch (err) {
    removeTypingIndicator(typingId);
    appendMessage('assistant', '⚠️ Error contacting the server. Ensure the server and LM Studio are running.');
  } finally {
    sendBtn.disabled = false;
    queryInput.focus();
  }
});

function appendMessage(role, text, sources = []) {
  const msgDiv = document.createElement('div');
  msgDiv.className = `message ${role}-message`;

  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  bubble.textContent = text;
  msgDiv.appendChild(bubble);

  if (sources && sources.length > 0) {
    const drawer = document.createElement('details');
    drawer.className = 'rag-drawer';
    drawer.innerHTML = `
      <summary>🔍 Retrieved Context (${sources.length} Policy Chunks)</summary>
      <div class="rag-sources">
        ${sources.map(s => `
          <div class="source-item">
            <div class="source-header">
              <span>${escapeHtml(s.title || 'Policy')}</span>
              <span class="source-score">Cosine Score: ${s.score != null ? s.score : 'N/A'}</span>
            </div>
            <div class="source-snippet">${escapeHtml((s.text || '').slice(0, 200))}...</div>
          </div>
        `).join('')}
      </div>
    `;
    msgDiv.appendChild(drawer);
  }

  chatBox.appendChild(msgDiv);
  chatBox.scrollTop = chatBox.scrollHeight;
}

function appendTypingIndicator() {
  const id = 'typing-' + Date.now();
  const div = document.createElement('div');
  div.id = id;
  div.className = 'message assistant-message';
  div.innerHTML = `<div class="bubble" style="font-style: italic; color: #9ca3af;">MIKU is thinking and searching store policies... 🌸</div>`;
  chatBox.appendChild(div);
  chatBox.scrollTop = chatBox.scrollHeight;
  return id;
}

function removeTypingIndicator(id) {
  const el = document.getElementById(id);
  if (el) el.remove();
}

function escapeHtml(str) {
  return String(str || '').replace(/[&<>'"]/g, tag => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  }[tag] || tag));
}
