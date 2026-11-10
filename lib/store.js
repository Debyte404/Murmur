// Upstash Redis & Fallback Storage Engine
// Authoritative global registry for unique usernames & peer IDs.
// Stores ONLY username <-> peer_id mappings (no IP addresses).

let upstashClient = null;

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
    return false;
  }

  try {
    const { Redis } = require('@upstash/redis');
    upstashClient = new Redis({ url, token });
    return upstashClient;
  } catch {
    return false;
  }
}

// In-memory fallback store for local development without Upstash configured
const memoryStore = new Map([
  [
    'debyte',
    {
      username: 'debyte',
      peer_id: '0x10000001',
      registered_at: '2026-11-01T00:00:00.000Z',
    },
  ],
  [
    'alice',
    {
      username: 'alice',
      peer_id: '0x10000002',
      registered_at: '2026-11-03T12:00:00.000Z',
    },
  ],
  [
    'neo',
    {
      username: 'neo',
      peer_id: '0x10000003',
      registered_at: '2026-11-05T09:30:00.000Z',
    },
  ],
]);

async function kvCommand(command, ...args) {
  const client = getUpstashClient();

  if (client) {
    try {
      const cmd = command.toLowerCase();
      if (cmd === 'get') {
        return await client.get(args[0]);
      } else if (cmd === 'set') {
        return await client.set(args[0], args[1]);
      }
    } catch (err) {
      console.warn('Upstash SDK error, falling back to REST fetch:', err.message);
    }
  }

  const url =
    process.env.UPSTASH_REDIS_REST_URL ||
    process.env.KV_REST_API_URL ||
    process.env.UPSTASH_REDIS_URL;
  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN ||
    process.env.KV_REST_API_TOKEN ||
    process.env.UPSTASH_REDIS_TOKEN;

  if (!url || !token) {
    return null;
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

function validateUsername(username) {
  if (!username || typeof username !== 'string') {
    return { valid: false, error: 'Username is required and must be a string' };
  }
  const normalized = username.trim().toLowerCase().replace(/^@/, '');
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

  const isAvailable = !memoryStore.has(name);
  return { available: isAvailable, username: name };
}

// Register username <-> peer_id
async function registerUser({ username, peer_id, nodeId }) {
  const validation = validateUsername(username);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const name = validation.username;
  const resolvedPeerId = peer_id || nodeId;

  if (!resolvedPeerId) {
    throw new Error('Missing required field: peer_id');
  }

  const { available } = await isUsernameAvailable(name);
  if (!available) {
    throw new Error(`Username '@${name}' is already taken`);
  }

  const record = {
    username: name,
    peer_id: String(resolvedPeerId),
    registered_at: new Date().toISOString(),
  };

  const kvKey = `murmur:user:${name}`;
  await kvCommand('SET', kvKey, JSON.stringify(record));
  memoryStore.set(name, record);

  return record;
}

// Lookup peer_id by username
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

module.exports = {
  validateUsername,
  isUsernameAvailable,
  registerUser,
  lookupUser,
};
