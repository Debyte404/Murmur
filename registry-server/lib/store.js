// Upstash Redis & Fallback Storage Engine
// Supports @upstash/redis SDK, direct Upstash REST API via native fetch, and in-memory store.

let upstashClient = null;

// Initialize Upstash Redis client if credentials exist
function getUpstashClient() {
  if (upstashClient !== null) return upstashClient;

  const url =
    process.env.UPSTASH_REDIS_REST_URL ||
    process.env.KV_REST_API_URL ||
    process.env.UPSTASH_REDIS_URL;
  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN ||
    process.env.KV_REST_API_TOKEN ||
    process.env.UPSTASH_REDIS_TOKEN;

  if (!url || !token) {
    return false; // Not configured
  }

  try {
    const { Redis } = require('@upstash/redis');
    upstashClient = new Redis({ url, token });
    return upstashClient;
  } catch {
    // If @upstash/redis package is not installed, fallback to direct REST fetch below
    return false;
  }
}

// In-memory fallback store for local development & instances without Upstash configured
const memoryStore = new Map([
  [
    'debyte',
    {
      username: 'debyte',
      node_id: '0x10000001',
      addresses: ['quic://murmur.debyte.space:9000', 'udp://115.248.83.151:9000'],
      pubkey: 'ed25519:6c6f7264646562797465616c7068616b65793031',
      registered_at: '2026-11-01T00:00:00.000Z',
      last_seen: new Date().toISOString(),
      bio: 'Core Maintainer @ Murmur P2P',
    },
  ],
  [
    'alice',
    {
      username: 'alice',
      node_id: '0x10000002',
      addresses: ['quic://peer-eu.debyte.space:9001'],
      pubkey: 'ed25519:616c6963657032706e6f646530326b6579303032',
      registered_at: '2026-11-03T12:00:00.000Z',
      last_seen: new Date().toISOString(),
      bio: 'Validator Node - Frankfurt',
    },
  ],
  [
    'neo',
    {
      username: 'neo',
      node_id: '0x10000003',
      addresses: ['quic://zion.mesh:9002'],
      pubkey: 'ed25519:6e656f7a696f6e3030337032706b657930303033',
      registered_at: '2026-11-05T09:30:00.000Z',
      last_seen: new Date().toISOString(),
      bio: 'Escaped the matrix. Only talk over QUIC.',
    },
  ],
]);

// Helper for Upstash Redis execution (SDK or REST fetch)
async function kvCommand(command, ...args) {
  const client = getUpstashClient();

  // 1. If @upstash/redis SDK is available, execute through it
  if (client) {
    try {
      const cmd = command.toLowerCase();
      if (cmd === 'get') {
        return await client.get(args[0]);
      } else if (cmd === 'set') {
        return await client.set(args[0], args[1]);
      } else if (cmd === 'sadd') {
        return await client.sadd(args[0], args[1]);
      } else if (cmd === 'smembers') {
        return await client.smembers(args[0]);
      }
    } catch (err) {
      console.warn('Upstash SDK error, falling back to REST fetch:', err.message);
    }
  }

  // 2. Direct Upstash REST API via global fetch
  const url =
    process.env.UPSTASH_REDIS_REST_URL ||
    process.env.KV_REST_API_URL ||
    process.env.UPSTASH_REDIS_URL;
  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN ||
    process.env.KV_REST_API_TOKEN ||
    process.env.UPSTASH_REDIS_TOKEN;

  if (!url || !token) {
    return null; // Signals fallback to in-memory store
  }

  try {
    const res = await fetch(`${url}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([command, ...args]),
    });

    if (!res.ok) {
      console.warn(`Upstash REST failed: ${res.status} ${res.statusText}`);
      return null;
    }

    const data = await res.json();
    return data.result;
  } catch (err) {
    console.warn('Upstash connection error, falling back to memory store:', err.message);
    return null;
  }
}

// Username validator: 3-24 characters, alphanumeric, lowercase, hyphen, underscore
function validateUsername(username) {
  if (!username || typeof username !== 'string') {
    return { valid: false, error: 'Username is required and must be a string' };
  }
  const normalized = username.trim().toLowerCase();
  if (normalized.length < 3 || normalized.length > 24) {
    return { valid: false, error: 'Username must be between 3 and 24 characters' };
  }
  if (!/^[a-z0-9_-]+$/.test(normalized)) {
    return { valid: false, error: 'Username can only contain lowercase letters, numbers, underscores, and hyphens' };
  }
  return { valid: true, username: normalized };
}

// Check availability
async function isUsernameAvailable(username) {
  const validation = validateUsername(username);
  if (!validation.valid) {
    return { available: false, error: validation.error, username };
  }

  const name = validation.username;
  const kvKey = `murmur:user:${name}`;

  const kvResult = await kvCommand('GET', kvKey);
  if (kvResult !== null) {
    return { available: false, username: name };
  }

  // If KV is not configured or returned null (key not found)
  const isAvailable = !memoryStore.has(name);
  return { available: isAvailable, username: name };
}

// Register username
async function registerUser({ username, nodeId, addresses, pubkey, bio }) {
  const validation = validateUsername(username);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const name = validation.username;
  const { available } = await isUsernameAvailable(name);
  if (!available) {
    throw new Error(`Username '@${name}' is already registered`);
  }

  if (!nodeId) {
    throw new Error('Missing required field: nodeId (e.g. 0x... or IP identifier)');
  }

  const record = {
    username: name,
    node_id: String(nodeId),
    addresses: Array.isArray(addresses) ? addresses : addresses ? [addresses] : [],
    pubkey: pubkey || null,
    bio: bio || '',
    registered_at: new Date().toISOString(),
    last_seen: new Date().toISOString(),
  };

  const kvKey = `murmur:user:${name}`;
  const kvSave = await kvCommand('SET', kvKey, JSON.stringify(record));
  if (kvSave !== null) {
    // Also append to active peers index in KV
    await kvCommand('SADD', 'murmur:peers_index', name);
  }

  // Update memory store as well
  memoryStore.set(name, record);

  return record;
}

// Lookup user
async function lookupUser(username) {
  const validation = validateUsername(username);
  if (!validation.valid) {
    return null;
  }

  const name = validation.username;
  const kvKey = `murmur:user:${name}`;
  const kvResult = await kvCommand('GET', kvKey);

  if (kvResult) {
    try {
      return typeof kvResult === 'string' ? JSON.parse(kvResult) : kvResult;
    } catch {
      return null;
    }
  }

  return memoryStore.get(name) || null;
}

// Heartbeat
async function updateHeartbeat(username, addresses = []) {
  const user = await lookupUser(username);
  if (!user) {
    throw new Error(`User '@${username}' not found`);
  }

  user.last_seen = new Date().toISOString();
  if (addresses && addresses.length > 0) {
    user.addresses = addresses;
  }

  const kvKey = `murmur:user:${username}`;
  await kvCommand('SET', kvKey, JSON.stringify(user));
  memoryStore.set(username, user);

  return user;
}

// List public / bootstrap peers
async function listPeers(limit = 20) {
  const peers = [];

  // Check KV peers index first
  const kvMembers = await kvCommand('SMEMBERS', 'murmur:peers_index');
  if (Array.isArray(kvMembers) && kvMembers.length > 0) {
    for (const name of kvMembers.slice(0, limit)) {
      const p = await lookupUser(name);
      if (p) peers.push(p);
    }
    if (peers.length > 0) return peers;
  }

  // Fallback to memory store
  for (const [_, record] of memoryStore.entries()) {
    peers.push(record);
    if (peers.length >= limit) break;
  }

  return peers;
}

module.exports = {
  validateUsername,
  isUsernameAvailable,
  registerUser,
  lookupUser,
  updateHeartbeat,
  listPeers,
};
