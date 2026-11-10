const { listPeers } = require('../lib/store');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const limit = parseInt(req.query?.limit || '50', 10);
    const peers = await listPeers(limit);

    return res.status(200).json({
      ok: true,
      count: peers.length,
      network: 'murmur-global-quic',
      domain: 'murmur.debyte.space',
      protocol: 'rustp2p-quic/0.1.2',
      peers,
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
};
