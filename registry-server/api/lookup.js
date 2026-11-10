const { lookupUser } = require('../lib/store');

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
        error: 'Query parameter "username" is required (e.g. /api/lookup?username=debyte)',
      });
    }

    const peer = await lookupUser(username);
    if (!peer) {
      return res.status(404).json({
        ok: false,
        error: `User '@${username}' not found in registry`,
      });
    }

    return res.status(200).json({
      ok: true,
      peer,
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
};
