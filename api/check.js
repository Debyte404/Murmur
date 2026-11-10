const { isUsernameAvailable } = require('../lib/store');

module.exports = async (req, res) => {
  // Enable CORS
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
        error: 'Query parameter "username" is required (e.g. /api/check?username=debyte)',
      });
    }

    const result = await isUsernameAvailable(username);
    return res.status(200).json({
      ok: true,
      username: result.username,
      available: result.available,
      error: result.error || null,
      message: result.available
        ? `Username '@${result.username}' is available!`
        : `Username '@${result.username}' is already taken.`,
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
};
