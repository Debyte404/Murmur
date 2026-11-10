// MURMUR // Keynote Industrial Experience JS

document.addEventListener('DOMContentLoaded', () => {
  initHealthCheck();
  initChassisTabs();
  initChatSimulator();
  initHandleScanner();
  initCopyButtons();
});

// ==========================================================================
// 1. HEALTH CHECK (REGISTRY STATUS)
// ==========================================================================
async function initHealthCheck() {
  const healthVal = document.getElementById('healthState');
  const radarDot = document.querySelector('.radar-dot');

  try {
    const res = await fetch('/api/health');
    if (res.ok) {
      const data = await res.json();
      if (healthVal) {
        healthVal.textContent = data.upstash_configured ? 'UPSTASH ONLINE' : 'ONLINE';
      }
      if (radarDot) {
        radarDot.style.backgroundColor = 'var(--lime)';
      }
    } else {
      throw new Error(`HTTP ${res.status}`);
    }
  } catch (err) {
    if (healthVal) healthVal.textContent = 'LOCAL MOCK';
  }
}

// ==========================================================================
// 2. CHASSIS TABS
// ==========================================================================
function initChassisTabs() {
  const tabs = document.querySelectorAll('.chassis-tab');
  const panes = {
    'live-tui': document.getElementById('pane-live-tui'),
    'stream-inspect': document.getElementById('pane-stream-inspect'),
    'wire-raw': document.getElementById('pane-wire-raw'),
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
// 3. INTERACTIVE CHAT SIMULATOR (TUI VIEWPORT)
// ==========================================================================
function initChatSimulator() {
  const feed = document.getElementById('liveChatFeed');
  const input = document.getElementById('simChatInput');
  const sendBtn = document.getElementById('btnSimSend');

  const btnAlice = document.getElementById('trigAlice');
  const btnHandshake = document.getElementById('trigHandshake');
  const btnPing = document.getElementById('trigPing');
  const btnClear = document.getElementById('trigClear');

  function getTimestamp() {
    const d = new Date();
    return `[${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}]`;
  }

  function appendEntry(authorClass, authorTag, text, isSys = false) {
    if (!feed) return;

    const row = document.createElement('div');
    row.className = isSys ? 'feed-entry sys' : 'feed-entry';

    const ts = document.createElement('span');
    ts.className = 'f-ts';
    ts.textContent = getTimestamp();
    row.appendChild(ts);

    if (!isSys) {
      const author = document.createElement('span');
      author.className = `f-author ${authorClass}`;
      author.textContent = `<${authorTag}>`;
      row.appendChild(author);
    }

    const msg = document.createElement('span');
    msg.className = 'f-msg';
    msg.textContent = isSys ? `>>> ${text}` : ` ${text}`;
    row.appendChild(msg);

    feed.appendChild(row);
    feed.scrollTop = feed.scrollHeight;
  }

  function handleSend() {
    if (!input) return;
    const txt = input.value.trim();
    if (!txt) return;

    appendEntry('user', '@you', txt);
    input.value = '';

    setTimeout(() => {
      const replies = [
        "Packet received in 11ms via direct QUIC stream.",
        "Zero packet loss detected over UDP socket.",
        "Ed25519 signature verified on incoming frame.",
        "Peer session active. Frame payload size: 64B.",
      ];
      const r = replies[Math.floor(Math.random() * replies.length)];
      appendEntry('alice', '@alice', r);
    }, 400);
  }

  if (sendBtn) sendBtn.addEventListener('click', handleSend);
  if (input) {
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSend();
      }
    });
  }

  if (btnAlice) {
    btnAlice.addEventListener('click', () => {
      appendEntry('alice', '@alice', 'Transmitted 4KB audio buffer over independent QUIC stream #5.');
    });
  }

  if (btnHandshake) {
    btnHandshake.addEventListener('click', () => {
      appendEntry('', '', 'Initiating 0-RTT QUIC handshake with peer (0x10000003)...', true);
      setTimeout(() => {
        appendEntry('', '', 'TLS 1.3 session ticket validated! QUIC tunnel online (14ms RTT).', true);
      }, 300);
    });
  }

  if (btnPing) {
    btnPing.addEventListener('click', () => {
      appendEntry('', '', 'Broadcasting mesh ping to active peers...', true);
      setTimeout(() => appendEntry('alice', '@alice', '[PONG] rtt=12ms loss=0.0%'), 180);
      setTimeout(() => appendEntry('neo', '@neo', '[PONG] rtt=18ms loss=0.0%'), 320);
    });
  }

  if (btnClear) {
    btnClear.addEventListener('click', () => {
      if (!feed) return;
      feed.innerHTML = '';
      appendEntry('', '', 'Feed cleared. Murmur TUI listener active on udp://0.0.0.0:8080', true);
    });
  }
}

// ==========================================================================
// 4. LIVE HANDLE SCANNER & CLAIM
// ==========================================================================
function initHandleScanner() {
  const input = document.getElementById('handleSearchInput');
  const btn = document.getElementById('btnScanHandle');
  const btnLabel = document.getElementById('btnScanLabel');

  const card = document.getElementById('scanResultCard');
  const icon = document.getElementById('scanIcon');
  const title = document.getElementById('scanTitle');
  const desc = document.getElementById('scanDesc');
  const cmd = document.getElementById('scanCmdBox');

  let debounceTimer = null;

  async function check() {
    if (!input) return;
    const raw = input.value.trim().replace(/^@/, '');

    if (!raw) {
      if (card) card.classList.add('hidden');
      return;
    }

    if (raw.length < 3) {
      showState({
        available: false,
        iconText: '⚠️',
        head: 'HANDLE TOO SHORT',
        info: 'Handles must be between 3 and 24 characters (lowercase letters, numbers, hyphens, underscores).',
        cli: null,
      });
      return;
    }

    if (btnLabel) btnLabel.textContent = 'SCANNING...';

    try {
      const res = await fetch(`/api/check?username=${encodeURIComponent(raw)}`);
      const data = await res.json();

      if (data.available) {
        showState({
          available: true,
          iconText: '⚡',
          head: `✔ @${data.username} IS AVAILABLE!`,
          info: 'This handle is unclaimed on the global mesh. You can reserve it right now.',
          cli: `murmur run --handle ${data.username}`,
        });
      } else {
        showState({
          available: false,
          iconText: '🔒',
          head: `✖ @${data.username} IS ALREADY REGISTERED`,
          info: data.error || 'This handle is already taken on murmur.debyte.space. Try another creative handle!',
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
      if (btnLabel) btnLabel.textContent = 'CHECK HANDLE';
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
// 5. COPY TO CLIPBOARD
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
        btn.style.borderColor = 'var(--lime)';

        setTimeout(() => {
          btn.innerHTML = original;
          btn.style.borderColor = '';
        }, 1500);
      } catch (err) {
        console.warn('Clipboard failed:', err);
      }
    });
  });
}
