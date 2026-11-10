module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const hasUpstash = Boolean(
    process.env.UPSTASH_REDIS_REST_URL ||
    process.env.KV_REST_API_URL ||
    process.env.UPSTASH_REDIS_URL
  );

  return res.status(200).json({
    status: 'online',
    service: 'Murmur Global P2P Registry',
    version: '1.0.0',
    protocol: 'rustp2p-quic/0.1.2',
    domain: 'murmur.debyte.space',
    quic_transport: 'multiplexed-udp',
    storage_backend: hasUpstash ? 'upstash-redis' : 'memory-store',
    upstash_configured: hasUpstash,
    timestamp: new Date().toISOString(),
  });
};
