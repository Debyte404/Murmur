const { isUsernameAvailable, mapErrorToStatus } = require('../lib/store');

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
        error: 'Query parameter "username" is required (e.g. /api/check?username=debyte)',
      });
    }

    const result = await isUsernameAvailable(username);
    return res.status(200).json({
      ok: true,
      username: result.username,
      available: result.available,
      message: result.available
        ? `Username '@${result.username}' is available!`
        : `Username '@${result.username}' is already taken.`,
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
