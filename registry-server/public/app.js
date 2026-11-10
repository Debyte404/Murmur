// MURMUR // Frontend Application & Interactive Simulator

document.addEventListener('DOMContentLoaded', () => {
  initHealthCheck();
  initTuiSimulator();
  initHandleChecker();
  initCopyButtons();
});

// ==========================================================================
// 1. HEALTH CHECK (REGISTRY CONNECTIVITY)
// ==========================================================================
async function initHealthCheck() {
  const healthEl = document.getElementById('healthState');
  const beaconEl = document.querySelector('.pulse-beacon');

  try {
    const res = await fetch('/api/health');
    if (res.ok) {
      const data = await res.json();
      if (healthEl) healthEl.textContent = 'ONLINE';
      if (beaconEl) {
        beaconEl.style.backgroundColor = 'var(--color-lime)';
        beaconEl.style.boxShadow = '0 0 8px var(--color-lime)';
      }
    } else {
      throw new Error(`Status ${res.status}`);
    }
  } catch (err) {
    console.warn('Registry health check offline/local:', err.message);
    if (healthEl) healthEl.textContent = 'LOCAL';
  }
}

// ==========================================================================
// 2. INTERACTIVE RATATUI TERMINAL CHAT SIMULATOR
// ==========================================================================
function initTuiSimulator() {
  const chatStream = document.getElementById('tuiChatStream');
  const userInput = document.getElementById('tuiUserInput');
  const sendBtn = document.getElementById('tuiSendBtn');

  const btnAlice = document.getElementById('btnSimAlice');
  const btnHandshake = document.getElementById('btnSimHandshake');
  const btnPing = document.getElementById('btnSimPing');
  const btnClear = document.getElementById('btnClearChat');

  function getTimestamp() {
    const now = new Date();
    return `[${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}]`;
  }

  function appendMessage(authorClass, authorName, text, isSystem = false) {
    if (!chatStream) return;

    const msgEl = document.createElement('div');
    msgEl.className = isSystem ? 'tui-msg system' : 'tui-msg';

    const timeSpan = document.createElement('span');
    timeSpan.className = 'tui-time';
    timeSpan.textContent = getTimestamp();
    msgEl.appendChild(timeSpan);

    if (!isSystem) {
      const authorSpan = document.createElement('span');
      authorSpan.className = `tui-author ${authorClass}`;
      authorSpan.textContent = `<${authorName}>`;
      msgEl.appendChild(authorSpan);
    }

    const bodySpan = document.createElement('span');
    bodySpan.className = 'tui-body';
    bodySpan.textContent = isSystem ? `>>> ${text}` : ` ${text}`;
    msgEl.appendChild(bodySpan);

    chatStream.appendChild(msgEl);
    chatStream.scrollTop = chatStream.scrollHeight;
  }

  function handleSend() {
    if (!userInput) return;
    const text = userInput.value.trim();
    if (!text) return;

    // Append user message
    appendMessage('user-you', '@you', text);
    userInput.value = '';

    // Simulate automated peer reply over QUIC after short delay
    setTimeout(() => {
      const replies = [
        "Received your QUIC datagram! Packet ACKed in 13ms.",
        "Verified frame signature via Ed25519 pubkey.",
        "Decentralized mesh route healthy. Zero hops through central cloud.",
        "Direct peer connection active. Stream throughput: 1.2 MB/s.",
      ];
      const randomReply = replies[Math.floor(Math.random() * replies.length)];
      appendMessage('user-alice', '@alice', randomReply);
    }, 550);
  }

  if (sendBtn) {
    sendBtn.addEventListener('click', handleSend);
  }

  if (userInput) {
    userInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSend();
      }
    });
  }

  // Quick Action: Alice speaks
  if (btnAlice) {
    btnAlice.addEventListener('click', () => {
      const aliceThoughts = [
        "Testing rustp2p-quic multiplexing... Stream #8 opened cleanly.",
        "Pushed 4KB encrypted message batch over QUIC frame.",
        "Zero packet loss detected on UDP port 8080.",
      ];
      const random = aliceThoughts[Math.floor(Math.random() * aliceThoughts.length)];
      appendMessage('user-alice', '@alice', random);
    });
  }

  // Quick Action: Handshake
  if (btnHandshake) {
    btnHandshake.addEventListener('click', () => {
      appendMessage('', '', 'Initiating 0-RTT QUIC Handshake with @neo (0x10000003)...', true);
      setTimeout(() => {
        appendMessage('', '', 'TLS 1.3 session ticket validated! QUIC connection established (RTT: 17ms)', true);
      }, 400);
    });
  }

  // Quick Action: Ping
  if (btnPing) {
    btnPing.addEventListener('click', () => {
      appendMessage('', '', 'Broadcasting QUIC PING to mesh...', true);
      setTimeout(() => {
        appendMessage('user-alice', '@alice', '[PONG] rtt=12ms loss=0.0%');
      }, 250);
      setTimeout(() => {
        appendMessage('user-neo', '@neo', '[PONG] rtt=19ms loss=0.0%');
      }, 450);
    });
  }

  // Quick Action: Clear
  if (btnClear) {
    btnClear.addEventListener('click', () => {
      if (!chatStream) return;
      chatStream.innerHTML = '';
      appendMessage('', '', 'Feed cleared. Murmur TUI listener active.', true);
    });
  }
}

// ==========================================================================
// 3. GLOBAL HANDLE REGISTRY CHECKER
// ==========================================================================
function initHandleChecker() {
  const usernameInput = document.getElementById('usernameInput');
  const checkBtn = document.getElementById('checkHandleBtn');
  const checkBtnLabel = document.getElementById('checkBtnLabel');

  const resultBox = document.getElementById('resultBox');
  const resultStatusIcon = document.getElementById('resultStatusIcon');
  const resultTitle = document.getElementById('resultTitle');
  const resultMessage = document.getElementById('resultMessage');
  const resultCliBlock = document.getElementById('resultCliBlock');

  let debounceTimer = null;

  async function performCheck() {
    if (!usernameInput) return;
    const raw = usernameInput.value.trim().replace(/^@/, '');

    if (!raw) {
      if (resultBox) resultBox.classList.add('hidden');
      return;
    }

    if (raw.length < 3) {
      showResult({
        available: false,
        title: 'HANDLE TOO SHORT',
        message: 'Usernames must be at least 3 characters long (letters, numbers, hyphens, underscores).',
        cli: null,
      });
      return;
    }

    if (checkBtnLabel) checkBtnLabel.textContent = 'Checking...';

    try {
      const res = await fetch(`/api/check?username=${encodeURIComponent(raw)}`);
      const data = await res.json();

      if (data.available) {
        showResult({
          available: true,
          title: `✔ @${data.username} IS AVAILABLE!`,
          message: `This handle is unclaimed on the global mesh. You can claim it right now via Murmur CLI or the REST API.`,
          cli: `murmur run --handle ${data.username} --port 8080`,
        });
      } else {
        showResult({
          available: false,
          title: `✖ @${data.username} IS ALREADY REGISTERED`,
          message: data.error || `This handle is taken on murmur.debyte.space. Try another creative handle!`,
          cli: `murmur connect @${data.username}`,
        });
      }
    } catch (err) {
      showResult({
        available: false,
        title: 'NETWORK TIMEOUT',
        message: `Could not reach registry: ${err.message}`,
        cli: null,
      });
    } finally {
      if (checkBtnLabel) checkBtnLabel.textContent = 'Check Handle';
    }
  }

  function showResult({ available, title, message, cli }) {
    if (!resultBox) return;

    resultBox.classList.remove('hidden', 'available', 'taken');
    resultBox.classList.add(available ? 'available' : 'taken');

    if (resultStatusIcon) {
      resultStatusIcon.textContent = available ? '⚡' : '🔒';
    }
    if (resultTitle) {
      resultTitle.textContent = title;
    }
    if (resultMessage) {
      resultMessage.textContent = message;
    }
    if (resultCliBlock) {
      if (cli) {
        resultCliBlock.style.display = 'block';
        resultCliBlock.textContent = `$ ${cli}`;
      } else {
        resultCliBlock.style.display = 'none';
      }
    }
  }

  if (checkBtn) {
    checkBtn.addEventListener('click', (e) => {
      e.preventDefault();
      performCheck();
    });
  }

  if (usernameInput) {
    usernameInput.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(performCheck, 400);
    });

    usernameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        clearTimeout(debounceTimer);
        performCheck();
      }
    });
  }
}

// ==========================================================================
// 4. COPY TO CLIPBOARD BUTTONS
// ==========================================================================
function initCopyButtons() {
  document.querySelectorAll('[data-copy]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const textToCopy = btn.getAttribute('data-copy');
      if (!textToCopy) return;

      try {
        await navigator.clipboard.writeText(textToCopy);
        const originalText = btn.textContent;
        btn.textContent = 'COPIED!';
        btn.style.backgroundColor = 'var(--color-lime)';
        btn.style.color = 'var(--color-dark)';

        setTimeout(() => {
          btn.textContent = originalText;
          btn.style.backgroundColor = '';
          btn.style.color = '';
        }, 1800);
      } catch (err) {
        console.warn('Clipboard failed:', err);
      }
    });
  });
}
