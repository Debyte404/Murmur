const { lookupUser, mapErrorToStatus } = require('../lib/store');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { username } = req.query || {};
    if (!username) {
      return res.status(400).json({
        ok: false,
        code: 'INVALID',
        error: 'Query parameter "username" is required (e.g. /api/lookup?username=debyte)',
      });
    }

    const peer = await lookupUser(username);
    return res.status(200).json({
      ok: true,
      username: peer.username,
      peer_id: peer.peer_id,
      public_key: peer.public_key || null,
      registered_at: peer.registered_at,
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
