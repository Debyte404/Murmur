const { registerUser, mapErrorToStatus } = require('../lib/store');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, code: 'METHOD_NOT_ALLOWED', error: 'Method not allowed. Use POST.' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const { username, peer_id, peerId, nodeId, token, public_key, pubkey } = body;

    const resolvedPeerId = peer_id || peerId || nodeId;

    const record = await registerUser({
      username,
      peer_id: resolvedPeerId,
      token,
      public_key: public_key || pubkey,
    });

    return res.status(201).json({
      ok: true,
      message: `Handle '@${record.username}' registered successfully!`,
      peer: {
        username: record.username,
        peer_id: record.peer_id,
        public_key: record.public_key,
        registered_at: record.registered_at,
      },
      token: record.token, // Secret credentials returned once for client ~/.config/murmur/creds
    });
  } catch (err) {
    const status = mapErrorToStatus(err);
    return res.status(status).json({
      ok: false,
      code: err.code || 'INTERNAL_ERROR',
      error: err.message,
    });
  }
};
