const { updateHeartbeat } = require('../lib/store');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed. Use POST.' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const { username, addresses } = body;

    if (!username) {
      return res.status(400).json({ ok: false, error: 'Missing required field: username' });
    }

    const peer = await updateHeartbeat(username, addresses);
    return res.status(200).json({
      ok: true,
      message: `Heartbeat acknowledged for @${peer.username}`,
      last_seen: peer.last_seen,
    });
  } catch (err) {
    const isNotFound = err.message.includes('not found');
    return res.status(isNotFound ? 404 : 400).json({
      ok: false,
      error: err.message,
    });
  }
};
