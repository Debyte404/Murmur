const { updateHeartbeat, mapErrorToStatus } = require('../lib/store');

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
    const authHeader = req.headers.authorization || req.headers.Authorization || '';
    const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;

    const username = body.username;
    const token = body.token || bearerToken;
    const addresses = body.addresses || [];

    if (!username) {
      return res.status(400).json({ ok: false, code: 'INVALID', error: 'Missing required field: username' });
    }
    if (!token) {
      return res.status(401).json({ ok: false, code: 'UNAUTHORIZED', error: 'Missing token for authentication' });
    }

    const peer = await updateHeartbeat(username, token, addresses);
    return res.status(200).json({
      ok: true,
      message: `Heartbeat acknowledged for @${peer.username}`,
      last_seen: peer.last_seen,
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
