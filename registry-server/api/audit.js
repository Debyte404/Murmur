const { auditLegacyData, mapErrorToStatus } = require('../lib/store');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const report = await auditLegacyData();
    return res.status(200).json({ ok: true, report });
  } catch (err) {
    const status = mapErrorToStatus(err);
    return res.status(status).json({ ok: false, error: err.message, code: err.code });
  }
};
