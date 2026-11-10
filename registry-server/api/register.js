const { registerUser } = require('../lib/store');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed. Use POST.' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const { username, peer_id, peerId, nodeId } = body;

    const resolvedPeerId = peer_id || peerId || nodeId;

    if (!username) {
      return res.status(400).json({ ok: false, error: 'Missing required field: username' });
    }
    if (!resolvedPeerId) {
      return res.status(400).json({ ok: false, error: 'Missing required field: peer_id' });
    }

    const record = await registerUser({ username, peer_id: resolvedPeerId });
    return res.status(201).json({
      ok: true,
      message: `Handle '@${record.username}' registered successfully!`,
      peer: record,
    });
  } catch (err) {
    const isConflict = err.message.includes('already taken');
    return res.status(isConflict ? 409 : 400).json({
      ok: false,
      error: err.message,
    });
  }
};
