// MURMUR // Frontend Application & Interactive Simulator

document.addEventListener('DOMContentLoaded', () => {
  initHealthCheck();
  initWindowTabs();
  initTuiSimulator();
  initHandleChecker();
  initCopyButtons();
});

// ==========================================================================
// 1. HEALTH CHECK (REGISTRY CONNECTIVITY)
// ==========================================================================
async function initHealthCheck() {
  const healthEl = document.getElementById('healthState');
  const pulseEl = document.querySelector('.pulse-indicator');

  try {
    const res = await fetch('/api/health');
    if (res.ok) {
      const data = await res.json();
      if (healthEl) {
        healthEl.textContent = data.upstash_configured ? 'UPSTASH ONLINE' : 'ONLINE';
      }
      if (pulseEl) {
        pulseEl.style.backgroundColor = 'var(--color-lime)';
      }
    } else {
      throw new Error(`HTTP ${res.status}`);
    }
  } catch (err) {
    if (healthEl) healthEl.textContent = 'LOCAL MOCK';
  }
}

// ==========================================================================
// 2. WINDOW TABS (WATERMELON UI COMPONENT TABS)
// ==========================================================================
function initWindowTabs() {
  const tabs = document.querySelectorAll('.win-tab');
  const panes = {
    tui: document.getElementById('pane-tui'),
    packets: document.getElementById('pane-packets'),
    api: document.getElementById('pane-api'),
  };

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      tabs.forEach((t) => t.classList.remove('active'));
      Object.values(panes).forEach((p) => p && p.classList.remove('active'));

      tab.classList.add('active');
      const target = tab.getAttribute('data-tab');
      if (panes[target]) {
        panes[target].classList.add('active');
      }
    });
  });
}

// ==========================================================================
// 3. INTERACTIVE RATATUI TERMINAL CHAT SIMULATOR
// ==========================================================================
function initTuiSimulator() {
  const chatArea = document.getElementById('tuiChatArea');
  const tuiInput = document.getElementById('tuiInput');
  const tuiSend = document.getElementById('tuiSend');

  const btnAlice = document.getElementById('simAliceMsg');
  const btnHandshake = document.getElementById('simHandshake');
  const btnPing = document.getElementById('simPing');
  const btnClear = document.getElementById('simClear');

  function getTimestamp() {
    const now = new Date();
    return `[${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}]`;
  }

  function appendMessage(authorClass, authorName, text, isSystem = false) {
    if (!chatArea) return;

    const row = document.createElement('div');
    row.className = isSystem ? 'msg-row system' : 'msg-row';

    const ts = document.createElement('span');
    ts.className = 'msg-ts';
    ts.textContent = getTimestamp();
    row.appendChild(ts);

    if (!isSystem) {
      const author = document.createElement('span');
      author.className = `msg-author ${authorClass}`;
      author.textContent = `<${authorName}>`;
      row.appendChild(author);
    }

    const body = document.createElement('span');
    body.className = 'msg-body';
    body.textContent = isSystem ? `>>> ${text}` : ` ${text}`;
    row.appendChild(body);

    chatArea.appendChild(row);
    chatArea.scrollTop = chatArea.scrollHeight;
  }

  function handleSend() {
    if (!tuiInput) return;
    const text = tuiInput.value.trim();
    if (!text) return;

    appendMessage('user-you', '@you', text);
    tuiInput.value = '';

    // Simulate automated peer ACK over QUIC
    setTimeout(() => {
      const replies = [
        "Received your QUIC packet! Handshake validated in 13ms.",
        "Zero packet loss detected over UDP. Multiplexed stream healthy.",
        "Direct peer connection active. Bypassed all central intermediaries.",
      ];
      const reply = replies[Math.floor(Math.random() * replies.length)];
      appendMessage('user-alice', '@alice', reply);
    }, 450);
  }

  if (tuiSend) tuiSend.addEventListener('click', handleSend);
  if (tuiInput) {
    tuiInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSend();
      }
    });
  }

  if (btnAlice) {
    btnAlice.addEventListener('click', () => {
      appendMessage('user-alice', '@alice', 'Testing rustp2p-quic datagram stream... Frame transmitted successfully.');
    });
  }

  if (btnHandshake) {
    btnHandshake.addEventListener('click', () => {
      appendMessage('', '', 'Initiating 0-RTT QUIC handshake with @neo (quic://zion.mesh:9002)...', true);
      setTimeout(() => {
        appendMessage('', '', 'TLS 1.3 session ticket validated! QUIC tunnel online (17ms RTT).', true);
      }, 350);
    });
  }

  if (btnPing) {
    btnPing.addEventListener('click', () => {
      appendMessage('', '', 'Broadcasting QUIC PING to mesh...', true);
      setTimeout(() => appendMessage('user-alice', '@alice', '[PONG] rtt=14ms loss=0.0%'), 200);
      setTimeout(() => appendMessage('user-neo', '@neo', '[PONG] rtt=19ms loss=0.0%'), 380);
    });
  }

  if (btnClear) {
    btnClear.addEventListener('click', () => {
      if (!chatArea) return;
      chatArea.innerHTML = '';
      appendMessage('', '', 'Feed cleared. Murmur TUI listener active on udp://0.0.0.0:8080', true);
    });
  }
}

// ==========================================================================
// 4. GLOBAL HANDLE REGISTRY CHECKER
// ==========================================================================
function initHandleChecker() {
  const input = document.getElementById('handleInput');
  const btn = document.getElementById('btnCheckHandle');
  const btnText = document.getElementById('btnCheckText');

  const card = document.getElementById('handleResultCard');
  const icon = document.getElementById('resultIcon');
  const title = document.getElementById('resultTitle');
  const desc = document.getElementById('resultDesc');
  const cmd = document.getElementById('resultCommandBox');

  let debounceTimer = null;

  async function check() {
    if (!input) return;
    const name = input.value.trim().replace(/^@/, '');

    if (!name) {
      if (card) card.classList.add('hidden');
      return;
    }

    if (name.length < 3) {
      showState({
        available: false,
        iconText: '⚠️',
        head: 'HANDLE TOO SHORT',
        info: 'Handles must be at least 3 characters long (letters, numbers, hyphens, underscores).',
        cli: null,
      });
      return;
    }

    if (btnText) btnText.textContent = 'Checking...';

    try {
      const res = await fetch(`/api/check?username=${encodeURIComponent(name)}`);
      const data = await res.json();

      if (data.available) {
        showState({
          available: true,
          iconText: '⚡',
          head: `✔ @${data.username} IS AVAILABLE!`,
          info: `This handle is unclaimed on the global mesh. You can reserve it right now via Murmur CLI or REST API.`,
          cli: `murmur run --handle ${data.username} --port 8080`,
        });
      } else {
        showState({
          available: false,
          iconText: '🔒',
          head: `✖ @${data.username} IS ALREADY TAKEN`,
          info: data.error || `This handle is already registered on murmur.debyte.space. Try another creative handle!`,
          cli: `murmur connect @${data.username}`,
        });
      }
    } catch (err) {
      showState({
        available: false,
        iconText: '❌',
        head: 'REGISTRY TIMEOUT',
        info: `Could not reach murmur.debyte.space: ${err.message}`,
        cli: null,
      });
    } finally {
      if (btnText) btnText.textContent = 'Check Availability';
    }
  }

  function showState({ available, iconText, head, info, cli }) {
    if (!card) return;

    card.classList.remove('hidden', 'available', 'taken');
    card.classList.add(available ? 'available' : 'taken');

    if (icon) icon.textContent = iconText;
    if (title) title.textContent = head;
    if (desc) desc.textContent = info;
    if (cmd) {
      if (cli) {
        cmd.style.display = 'block';
        cmd.textContent = `$ ${cli}`;
      } else {
        cmd.style.display = 'none';
      }
    }
  }

  if (btn) {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      check();
    });
  }

  if (input) {
    input.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(check, 350);
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        clearTimeout(debounceTimer);
        check();
      }
    });
  }
}

// ==========================================================================
// 5. COPY TO CLIPBOARD BUTTONS
// ==========================================================================
function initCopyButtons() {
  document.querySelectorAll('[data-copy]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const text = btn.getAttribute('data-copy');
      if (!text) return;

      try {
        await navigator.clipboard.writeText(text);
        const original = btn.innerHTML;
        btn.innerHTML = '<span>COPIED!</span>';
        btn.style.borderColor = 'var(--color-lime)';

        setTimeout(() => {
          btn.innerHTML = original;
          btn.style.borderColor = '';
        }, 1600);
      } catch (err) {
        console.warn('Clipboard failed:', err);
      }
    });
  });
}
