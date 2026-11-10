const { releaseUser, mapErrorToStatus } = require('../lib/store');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST' && req.method !== 'DELETE') {
    return res.status(405).json({ ok: false, code: 'METHOD_NOT_ALLOWED', error: 'Method not allowed. Use POST or DELETE.' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const authHeader = req.headers.authorization || req.headers.Authorization || '';
    const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;

    const username = body.username || req.query?.username;
    const token = body.token || bearerToken;

    if (!username) {
      return res.status(400).json({ ok: false, code: 'INVALID', error: 'Missing required field: username' });
    }
    if (!token) {
      return res.status(401).json({ ok: false, code: 'UNAUTHORIZED', error: 'Missing token for authentication' });
    }

    const result = await releaseUser(username, token);
    return res.status(200).json({
      ok: true,
      message: `Handle '@${result.released}' successfully released from registry.`,
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
