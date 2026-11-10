// Murmur Frontend Controller & Interactive Terminal Simulator

document.addEventListener('DOMContentLoaded', () => {
  initMetaballs();
  initHealth();
  initTerminalTabs();
  initTerminalSimulator();
  initRadarScanner();
  initCopyButtons();
});

// ==========================================================================
// 1. HEALTH STATUS
// ==========================================================================
async function initHealth() {
  const healthEl = document.getElementById('healthState');
  const beacon = document.querySelector('.status-beacon');

  try {
    const res = await fetch('/api/health');
    const contentType = res.headers.get('content-type') || '';
    if (res.ok && contentType.includes('application/json')) {
      const data = await res.json();
      if (healthEl) {
        healthEl.textContent = data.upstash_configured ? 'UPSTASH ONLINE' : 'ONLINE';
      }
      if (beacon) beacon.style.backgroundColor = 'var(--lime)';
    } else {
      throw new Error(`HTTP ${res.status}`);
    }
  } catch {
    if (healthEl) healthEl.textContent = 'ONLINE';
  }
}

// ==========================================================================
// 2. TERMINAL TABS
// ==========================================================================
function initTerminalTabs() {
  const tabs = document.querySelectorAll('.term-tab');
  const views = {
    chat: document.getElementById('view-chat'),
    packets: document.getElementById('view-packets'),
    registry: document.getElementById('view-registry'),
  };

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      tabs.forEach((t) => t.classList.remove('active'));
      Object.values(views).forEach((v) => v && v.classList.remove('active'));

      tab.classList.add('active');
      const target = tab.getAttribute('data-tab');
      if (views[target]) {
        views[target].classList.add('active');
      }
    });
  });
}

// ==========================================================================
// 3. INTERACTIVE TERMINAL CHAT
// ==========================================================================
function initTerminalSimulator() {
  const feed = document.getElementById('chatFeed');
  const input = document.getElementById('interactiveInput');
  const sendBtn = document.getElementById('btnSendChat');

  const chipAlice = document.getElementById('chipAlice');
  const chipHandshake = document.getElementById('chipHandshake');
  const chipPing = document.getElementById('chipPing');
  const chipClear = document.getElementById('chipClear');

  function getTimestamp() {
    const d = new Date();
    return `[${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}]`;
  }

  function appendChat(authorClass, authorTag, text, isSys = false) {
    if (!feed) return;

    const row = document.createElement('div');
    row.className = isSys ? 'chat-row sys' : 'chat-row';

    const ts = document.createElement('span');
    ts.className = 'chat-ts';
    ts.textContent = getTimestamp();
    row.appendChild(ts);

    if (!isSys) {
      const author = document.createElement('span');
      author.className = `chat-sender ${authorClass}`;
      author.textContent = `<${authorTag}>`;
      row.appendChild(author);
    }

    const msg = document.createElement('span');
    msg.className = 'chat-text';
    msg.textContent = isSys ? `>>> ${text}` : ` ${text}`;
    row.appendChild(msg);

    feed.appendChild(row);
    feed.scrollTop = feed.scrollHeight;
  }

  function handleSend() {
    if (!input) return;
    const txt = input.value.trim();
    if (!txt) return;

    appendChat('user', '@you', txt);
    input.value = '';

    setTimeout(() => {
      const replies = [
        "Packet received in 11ms via direct QUIC stream.",
        "Zero packet loss detected over UDP socket.",
        "Ed25519 signature verified on incoming frame.",
        "Peer session active. Frame payload size: 64B.",
      ];
      const r = replies[Math.floor(Math.random() * replies.length)];
      appendChat('alice', '@alice', r);
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

  if (chipAlice) {
    chipAlice.addEventListener('click', () => {
      appendChat('alice', '@alice', 'Transmitted 4KB audio buffer over independent QUIC stream #5.');
    });
  }

  if (chipHandshake) {
    chipHandshake.addEventListener('click', () => {
      appendChat('', '', 'Initiating 0-RTT QUIC handshake with peer (0x10000003)...', true);
      setTimeout(() => {
        appendChat('', '', 'TLS 1.3 session ticket validated! QUIC tunnel online (14ms RTT).', true);
      }, 300);
    });
  }

  if (chipPing) {
    chipPing.addEventListener('click', () => {
      appendChat('', '', 'Broadcasting mesh ping to active peers...', true);
      setTimeout(() => appendChat('alice', '@alice', '[PONG] rtt=12ms loss=0.0%'), 180);
      setTimeout(() => appendChat('neo', '@neo', '[PONG] rtt=18ms loss=0.0%'), 320);
    });
  }

  if (chipClear) {
    chipClear.addEventListener('click', () => {
      if (!feed) return;
      feed.innerHTML = '';
      appendChat('', '', 'Feed cleared. Murmur TUI listener active on udp://0.0.0.0:8080', true);
    });
  }
}

// ==========================================================================
// 4. RADAR HANDLE SCANNER
// ==========================================================================
function initRadarScanner() {
  const input = document.getElementById('radarInput');
  const btn = document.getElementById('btnRadarCheck');
  const btnLabel = document.getElementById('btnRadarLabel');

  const card = document.getElementById('radarResult');
  const icon = document.getElementById('radarIcon');
  const title = document.getElementById('radarTitle');
  const desc = document.getElementById('radarDesc');
  const cmd = document.getElementById('radarCmd');

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
      const contentType = res.headers.get('content-type') || '';

      if (!contentType.includes('application/json')) {
        throw new Error('Registry endpoint returned non-JSON. The Vercel serverless deployment is updating. Please retry in a few seconds.');
      }

      const data = await res.json();

      if (data.available) {
        showState({
          state: 'available',
          iconText: '⚡',
          head: `✔ @${data.username} IS AVAILABLE!`,
          info: 'This handle is unclaimed on the global mesh. You can reserve it right now.',
          cli: `murmur run --handle ${data.username}`,
        });
      } else {
        showState({
          state: 'taken',
          iconText: '🔒',
          head: `✖ @${data.username} IS ALREADY REGISTERED`,
          info: data.error || 'This handle is already registered on murmur.debyte.space. Try another creative handle!',
          cli: `murmur connect @${data.username}`,
        });
      }
    } catch (err) {
      showState({
        state: 'error',
        iconText: '⚠️',
        head: 'REGISTRY NOTICE',
        info: err.message,
        cli: null,
      });
    } finally {
      if (btnLabel) btnLabel.textContent = 'Check Handle';
    }
  }

  function showState({ state, iconText, head, info, cli }) {
    if (!card) return;

    card.classList.remove('hidden', 'available', 'taken', 'error');
    card.classList.add(state);

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

// ==========================================================================
// 6. METABALLS BACKGROUND ENGINE (Greenish with Amber Highlights)
// ==========================================================================
function initMetaballs() {
  const canvas = document.getElementById('metaballsCanvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  let width = (canvas.width = window.innerWidth);
  let height = (canvas.height = window.innerHeight);
  let dpr = Math.min(window.devicePixelRatio || 1, 2);

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    canvas.style.width = `${window.innerWidth}px`;
    canvas.style.height = `${window.innerHeight}px`;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
  }
  resize();
  window.addEventListener('resize', resize, { passive: true });

  // Mouse interaction & easing
  const mouse = {
    x: window.innerWidth * 0.5,
    y: window.innerHeight * 0.35,
    targetX: window.innerWidth * 0.5,
    targetY: window.innerHeight * 0.35,
  };

  window.addEventListener(
    'mousemove',
    (e) => {
      mouse.targetX = e.clientX;
      mouse.targetY = e.clientY;
    },
    { passive: true }
  );

  // Five organic, fluidly floating metaballs
  // Palette: Citrus Greens (#B7FF3C, #2EC4B6) with Amber Highlights (#FFB703, #FF9E00)
  const balls = [
    {
      x: window.innerWidth * 0.22,
      y: window.innerHeight * 0.28,
      vx: 0.32,
      vy: 0.22,
      baseRadius: 280,
      pulseSpeed: 0.0016,
      pulsePhase: 0,
      gradient: [
        { stop: 0, color: 'rgba(255, 183, 3, 0.55)' },    // Punchy Amber core highlight
        { stop: 0.3, color: 'rgba(183, 255, 60, 0.65)' },  // Electric Lime body
        { stop: 0.65, color: 'rgba(143, 227, 36, 0.28)' }, // Citrus green fringe
        { stop: 1, color: 'rgba(183, 255, 60, 0)' },
      ],
    },
    {
      x: window.innerWidth * 0.74,
      y: window.innerHeight * 0.24,
      vx: -0.28,
      vy: 0.26,
      baseRadius: 310,
      pulseSpeed: 0.0013,
      pulsePhase: 2.1,
      gradient: [
        { stop: 0, color: 'rgba(255, 195, 0, 0.6)' },     // Golden amber core
        { stop: 0.32, color: 'rgba(183, 255, 60, 0.52)' }, // Lime body
        { stop: 0.7, color: 'rgba(46, 196, 182, 0.22)' },  // Teal transition
        { stop: 1, color: 'rgba(46, 196, 182, 0)' },
      ],
    },
    {
      x: window.innerWidth * 0.48,
      y: window.innerHeight * 0.65,
      vx: 0.2,
      vy: -0.3,
      baseRadius: 340,
      pulseSpeed: 0.0011,
      pulsePhase: 4.2,
      gradient: [
        { stop: 0, color: 'rgba(183, 255, 60, 0.45)' },   // Citrus Lime
        { stop: 0.38, color: 'rgba(46, 196, 182, 0.38)' }, // Emerald / Teal depth
        { stop: 0.75, color: 'rgba(20, 140, 120, 0.15)' },
        { stop: 1, color: 'rgba(20, 140, 120, 0)' },
      ],
    },
    {
      x: window.innerWidth * 0.82,
      y: window.innerHeight * 0.75,
      vx: -0.26,
      vy: -0.2,
      baseRadius: 240,
      pulseSpeed: 0.002,
      pulsePhase: 1.4,
      gradient: [
        { stop: 0, color: 'rgba(255, 183, 3, 0.7)' },     // Intense Amber highlight
        { stop: 0.35, color: 'rgba(255, 150, 0, 0.35)' },  // Warm orange rim
        { stop: 0.68, color: 'rgba(183, 255, 60, 0.25)' }, // Green edge
        { stop: 1, color: 'rgba(183, 255, 60, 0)' },
      ],
    },
    {
      x: window.innerWidth * 0.14,
      y: window.innerHeight * 0.78,
      vx: 0.24,
      vy: -0.22,
      baseRadius: 260,
      pulseSpeed: 0.0015,
      pulsePhase: 3.2,
      gradient: [
        { stop: 0, color: 'rgba(255, 215, 60, 0.55)' },   // Solar amber
        { stop: 0.32, color: 'rgba(183, 255, 60, 0.5)' },  // Lime
        { stop: 0.7, color: 'rgba(100, 210, 40, 0.18)' },  // Lush green
        { stop: 1, color: 'rgba(100, 210, 40, 0)' },
      ],
    },
  ];

  let lastTime = performance.now();
  let isRunning = true;

  document.addEventListener('visibilitychange', () => {
    isRunning = !document.hidden;
    if (isRunning) {
      lastTime = performance.now();
      requestAnimationFrame(render);
    }
  });

  function render(now) {
    if (!isRunning) return;
    const dt = Math.min((now - lastTime) / 1000, 0.1);
    lastTime = now;

    // Smooth cursor follow
    mouse.x += (mouse.targetX - mouse.x) * 0.04;
    mouse.y += (mouse.targetY - mouse.y) * 0.04;

    const w = window.innerWidth;
    const h = window.innerHeight;

    ctx.clearRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'screen';

    balls.forEach((ball) => {
      // Harmonic velocity
      ball.x += ball.vx * 60 * dt;
      ball.y += ball.vy * 60 * dt;

      // Soft boundary repulsion
      const pad = ball.baseRadius * 0.4;
      if (ball.x < -pad) ball.vx = Math.abs(ball.vx);
      if (ball.x > w + pad) ball.vx = -Math.abs(ball.vx);
      if (ball.y < -pad) ball.vy = Math.abs(ball.vy);
      if (ball.y > h + pad) ball.vy = -Math.abs(ball.vy);

      // Subtle mouse gravity field
      const dx = mouse.x - ball.x;
      const dy = mouse.y - ball.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 480 && dist > 15) {
        ball.x += (dx / dist) * 0.35;
        ball.y += (dy / dist) * 0.35;
      }

      // Organic pulsation
      const currentRadius = ball.baseRadius + Math.sin(now * ball.pulseSpeed + ball.pulsePhase) * 32;

      // Radial gradient with amber core highlight
      const grad = ctx.createRadialGradient(
        ball.x - currentRadius * 0.12,
        ball.y - currentRadius * 0.12,
        currentRadius * 0.04,
        ball.x,
        ball.y,
        currentRadius
      );

      ball.gradient.forEach((g) => {
        grad.addColorStop(g.stop, g.color);
      });

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, currentRadius, 0, Math.PI * 2);
      ctx.fill();
    });

    requestAnimationFrame(render);
  }

  requestAnimationFrame(render);
}
