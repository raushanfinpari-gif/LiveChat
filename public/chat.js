let baseUrl = '';
let lastId = 0;
let interval = null;
let connected = false;

function el(id) { return document.getElementById(id); }

window.onload = () => {
  const saved = localStorage.getItem('livechat_token');
  if (saved) {
    el('tokenInput').value = saved;
    el('rememberCheck').checked = true;
  }
  el('connectBtn').addEventListener('click', connect);
  el('sendBtn').addEventListener('click', sendMessage);
  el('refreshBtn').addEventListener('click', () => loadMessages(true));
  el('msgInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') sendMessage(); });
};

function setStatus(text, ok) {
  const s = el('connStatus');
  s.textContent = text;
  s.className = 'status ' + (ok ? 'ok' : 'err');
}

function getHeaders() {
  return {
    'Content-Type': 'application/json',
    'X-Agent-Chat-Token': el('tokenInput').value.trim()
  };
}

async function api(path, opts = {}) {
  const res = await fetch(baseUrl + path, {
    ...opts,
    headers: { ...getHeaders(), ...(opts.headers || {}) }
  });
  if (res.status === 401 || res.status === 403) {
    throw new Error('Invalid token');
  }
  if (!res.ok) {
    const body = await res.text();
    throw new Error(body || 'HTTP ' + res.status);
  }
  return res.json();
}

function connect() {
  const token = el('tokenInput').value.trim();
  if (!token) { alert('Token is required'); return; }
  if (el('rememberCheck').checked) {
    localStorage.setItem('livechat_token', token);
  } else {
    localStorage.removeItem('livechat_token');
  }
  connected = true;
  lastId = 0;
  el('messages').innerHTML = '';
  loadMessages(true);
  if (interval) clearInterval(interval);
  interval = setInterval(() => loadMessages(false), 5000);
  setStatus('Connected', true);
}

function escapeHtml(text) {
  const d = document.createElement('div');
  d.textContent = text;
  return d.innerHTML;
}

function formatTime(iso) {
  const d = new Date(iso);
  return d.toLocaleString();
}

function renderMessage(m) {
  const div = document.createElement('div');
  div.className = 'msg';
  div.innerHTML = `
    <div class="msg-header">
      <span class="msg-sender">${escapeHtml(m.sender)}</span>
      ${m.task ? `<span class="msg-task">${escapeHtml(m.task)}</span>` : ''}
      <span class="msg-time">${formatTime(m.createdAt)}</span>
    </div>
    <div class="msg-text">${escapeHtml(m.text)}</div>
    <div class="msg-id">#${m.id}</div>
  `;
  return div;
}

async function loadMessages(forceScroll) {
  if (!connected) return;
  try {
    const data = await api('/agent-chat/messages?after=' + lastId);
    const msgs = data.messages || [];
    const container = el('messages');
    const filter = el('filterTask').value.trim();

    if (msgs.length === 0 && container.children.length === 0) {
      container.innerHTML = '<div class="empty">No messages yet.</div>';
      return;
    }
    if (msgs.length > 0) {
      const empty = container.querySelector('.empty');
      if (empty) empty.remove();
    }

    let added = 0;
    for (const m of msgs) {
      if (m.id > lastId) {
        lastId = m.id;
        if (!filter || (m.task && m.task === filter) || (!m.task && !filter)) {
          container.appendChild(renderMessage(m));
          added++;
        }
      }
    }

    if (added && forceScroll !== false) {
      container.scrollTop = container.scrollHeight;
    }
    setStatus('Connected', true);
  } catch (e) {
    setStatus(e.message || 'Error', false);
  }
}

async function sendMessage() {
  const input = el('msgInput');
  const text = input.value.trim();
  if (!text) return;
  if (!connected) { alert('Click Connect first'); return; }
  if (text.length > 4000) { alert('Message too long (max 4000)'); return; }

  const btn = el('sendBtn');
  btn.disabled = true;
  try {
    await api('/agent-chat/send', {
      method: 'POST',
      body: JSON.stringify({
        sender: el('senderInput').value.trim() || 'user',
        task: el('taskInput').value.trim() || undefined,
        text
      })
    });
    input.value = '';
    await loadMessages(true);
  } catch (e) {
    alert('Send failed: ' + (e.message || e));
  }
  btn.disabled = false;
}
