// Upstash Redis & Fallback Storage Engine for Murmur Global Registry
// Authoritative global registry for unique usernames & peer IDs.
// Stores ONLY username <-> peer_id mappings with cryptographic token verification.

const crypto = require('crypto');

// ==========================================================================
// 1. ERROR DEFINITIONS
// ==========================================================================
class RegistryError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'RegistryError';
    this.code = code; // TAKEN | INVALID | NOT_FOUND | UNAUTHORIZED | UNAVAILABLE
  }
}

class StorageUnavailableError extends RegistryError {
  constructor(message = 'Storage backend is unavailable') {
    super(message, 'UNAVAILABLE');
    this.name = 'StorageUnavailableError';
  }
}

// ==========================================================================
// 2. IN-MEMORY FALLBACK CLIENT (DEV ONLY - ZERO PRODUCTION MAP SEEDING)
// ==========================================================================
class MemoryRedisClient {
  constructor() {
    this.data = new Map();
    this.sets = new Map();
  }

  async get(key) {
    return this.data.has(key) ? this.data.get(key) : null;
  }

  async set(key, value, opts) {
    if (opts && opts.nx) {
      if (this.data.has(key)) {
        return null; // Key already exists (standard Redis SET NX return)
      }
      this.data.set(key, value);
      return 'OK';
    }
    this.data.set(key, value);
    return 'OK';
  }

  async del(...keys) {
    let count = 0;
    for (const key of keys) {
      if (this.data.delete(key)) count++;
    }
    return count;
  }

  async keys(pattern = '*') {
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    const matches = [];
    for (const key of this.data.keys()) {
      if (regex.test(key)) matches.push(key);
    }
    return matches;
  }

  async sadd(key, ...members) {
    if (!this.sets.has(key)) {
      this.sets.set(key, new Set());
    }
    const set = this.sets.get(key);
    let count = 0;
    for (const m of members) {
      if (!set.has(m)) {
        set.add(m);
        count++;
      }
    }
    return count;
  }

  async smembers(key) {
    if (!this.sets.has(key)) return [];
    return Array.from(this.sets.get(key));
  }

  async srem(key, ...members) {
    if (!this.sets.has(key)) return 0;
    const set = this.sets.get(key);
    let count = 0;
    for (const m of members) {
      if (set.delete(m)) count++;
    }
    return count;
  }
}

// ==========================================================================
// 3. CLIENT INITIALIZATION & CONFIGURATION
// ==========================================================================
let activeClient = null;
let clientType = null; // 'upstash' | 'memory'
let memoryWarnLogged = false;

function hasUpstashConfig() {
  return Boolean(
    process.env.UPSTASH_REDIS_REST_URL ||
    process.env.KV_REST_API_URL ||
    process.env.UPSTASH_REDIS_URL
  );
}

function getClient() {
  if (activeClient !== null) return activeClient;

  const url =
    process.env.UPSTASH_REDIS_REST_URL ||
    process.env.KV_REST_API_URL ||
    process.env.UPSTASH_REDIS_URL;
  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN ||
    process.env.KV_REST_API_TOKEN ||
    process.env.UPSTASH_REDIS_TOKEN;

  if (url && token) {
    try {
      const { Redis } = require('@upstash/redis');
      activeClient = new Redis({ url, token });
      clientType = 'upstash';
      return activeClient;
    } catch (err) {
      throw new StorageUnavailableError(`Failed to initialize Upstash client: ${err.message}`);
    }
  }

  // Memory fallback: ONLY active when NO Upstash environment variables are set
  if (!memoryWarnLogged) {
    console.warn(
      '⚠️ [WARN] Upstash environment variables not set. Using volatile in-memory fallback for local development.'
    );
    memoryWarnLogged = true;
  }
  activeClient = new MemoryRedisClient();
  clientType = 'memory';
  return activeClient;
}

// Generic KV command dispatcher using ONLY @upstash/redis client methods
async function kvCommand(command, ...args) {
  const client = getClient();
  const method = String(command).toLowerCase();

  if (typeof client[method] !== 'function') {
    throw new RegistryError(`Unsupported KV command: ${command}`, 'INVALID');
  }

  try {
    return await client[method](...args);
  } catch (err) {
    // If Upstash variables are set and it fails, throw StorageUnavailableError
    if (clientType === 'upstash') {
      throw new StorageUnavailableError(`Upstash Redis error during ${command}: ${err.message}`);
    }
    throw err;
  }
}

// Reset client (used for testing environment variable changes)
function resetClient() {
  activeClient = null;
  clientType = null;
  memoryWarnLogged = false;
}

// ==========================================================================
// 4. VALIDATORS (ONE RULE, USED EVERYWHERE)
// ==========================================================================

// Rule 11: normalize by trimming, lowercasing, and removing ONE leading "@".
// Require /^[a-z0-9_-]{3,24}$/.
function normalizeUsername(username) {
  if (!username || typeof username !== 'string') {
    throw new RegistryError('Username is required and must be a string', 'INVALID');
  }
  let normalized = username.trim().toLowerCase();
  if (normalized.startsWith('@')) {
    normalized = normalized.slice(1);
  }
  if (!/^[a-z0-9_-]{3,24}$/.test(normalized)) {
    throw new RegistryError(
      'Username must be between 3 and 24 characters and contain only lowercase letters, numbers, underscores, and hyphens',
      'INVALID'
    );
  }
  return normalized;
}

// Legacy-compatible validator wrapper
function validateUsername(username) {
  try {
    const normalized = normalizeUsername(username);
    return { valid: true, username: normalized };
  } catch (err) {
    return { valid: false, error: err.message };
  }
}

// Rule 12: string, 1 to 128 characters, /^[A-Za-z0-9._:-]+$/
function validatePeerId(peerId) {
  if (!peerId || typeof peerId !== 'string') {
    throw new RegistryError('Peer ID is required and must be a string', 'INVALID');
  }
  const trimmed = peerId.trim();
  if (trimmed.length < 1 || trimmed.length > 128 || !/^[A-Za-z0-9._:-]+$/.test(trimmed)) {
    throw new RegistryError(
      'Peer ID must be 1 to 128 characters and contain only letters, numbers, dot, underscore, colon, and hyphen',
      'INVALID'
    );
  }
  return trimmed;
}

// ==========================================================================
// 5. REGISTRY OPERATIONS
// ==========================================================================

// Read-only availability check
async function isUsernameAvailable(username) {
  const normalized = normalizeUsername(username);
  const userKey = `murmur:user:${normalized}`;
  const raw = await kvCommand('GET', userKey);
  return { available: raw === null, username: normalized };
}

// Atomic registration: SET user NX, then SET peer NX. Rollback user on peer collision.
async function registerUser({ username, peer_id, peerId, nodeId, token: providedToken, public_key, pubkey }) {
  const normalizedUser = normalizeUsername(username);
  const resolvedPeerId = validatePeerId(peer_id || peerId || nodeId);
  const resolvedPubkey = public_key || pubkey || null;

  // Generate secure 32-byte hex token if not supplied
  const rawToken = providedToken || crypto.randomBytes(32).toString('hex');
  const token_hash = crypto.createHash('sha256').update(rawToken).digest('hex');

  const nowIso = new Date().toISOString();
  const record = {
    username: normalizedUser,
    peer_id: resolvedPeerId,
    token_hash,
    public_key: resolvedPubkey,
    registered_at: nowIso,
    last_seen: nowIso,
  };

  const userKey = `murmur:user:${normalizedUser}`;
  const peerKey = `murmur:peer:${resolvedPeerId}`;

  // 1. Atomic SET NX for username
  const userSetRes = await kvCommand('SET', userKey, JSON.stringify(record), { nx: true });
  if (userSetRes !== 'OK') {
    throw new RegistryError(`Username '@${normalizedUser}' is already taken`, 'TAKEN');
  }

  // 2. Atomic SET NX for peer_id uniqueness
  const peerSetRes = await kvCommand('SET', peerKey, normalizedUser, { nx: true });
  if (peerSetRes !== 'OK') {
    // Rollback: Delete the user key we just created to prevent orphaned state
    try {
      await kvCommand('DEL', userKey);
    } catch (delErr) {
      console.error(`[CRITICAL] Rollback failed for ${userKey}:`, delErr.message);
    }
    throw new RegistryError(`Peer ID '${resolvedPeerId}' is already registered to another user`, 'TAKEN');
  }

  // 3. Track active peers index
  try {
    await kvCommand('SADD', 'murmur:peers_index', normalizedUser);
  } catch (idxErr) {
    // Non-fatal index tracking
  }

  return {
    username: normalizedUser,
    peer_id: resolvedPeerId,
    public_key: resolvedPubkey,
    registered_at: nowIso,
    token: rawToken, // Returned to the caller once; never saved in plain text
  };
}

// Token verification with timingSafeEqual and length checking
async function verifyToken(username, token) {
  const normalized = normalizeUsername(username);
  if (!token || typeof token !== 'string') {
    throw new RegistryError('Unauthorized: invalid credentials', 'UNAUTHORIZED');
  }

  const userKey = `murmur:user:${normalized}`;
  const raw = await kvCommand('GET', userKey);
  if (!raw) {
    // Same error for unknown user and wrong token
    throw new RegistryError('Unauthorized: invalid credentials', 'UNAUTHORIZED');
  }

  const record = typeof raw === 'string' ? JSON.parse(raw) : raw;
  if (!record || !record.token_hash) {
    throw new RegistryError('Unauthorized: invalid credentials', 'UNAUTHORIZED');
  }

  const incomingHash = crypto.createHash('sha256').update(token).digest('hex');
  const bufIncoming = Buffer.from(incomingHash, 'hex');
  const bufStored = Buffer.from(record.token_hash, 'hex');

  if (bufIncoming.length !== bufStored.length || !crypto.timingSafeEqual(bufIncoming, bufStored)) {
    throw new RegistryError('Unauthorized: invalid credentials', 'UNAUTHORIZED');
  }

  return record;
}

// Lookup peer_id & public info by username (excludes token_hash)
async function lookupUser(username) {
  const normalized = normalizeUsername(username);
  const userKey = `murmur:user:${normalized}`;
  const raw = await kvCommand('GET', userKey);

  if (!raw) {
    throw new RegistryError(`User '@${normalized}' not found in registry`, 'NOT_FOUND');
  }

  const record = typeof raw === 'string' ? JSON.parse(raw) : raw;
  const { token_hash, ...cleanRecord } = record;
  return cleanRecord;
}

// Heartbeat update with token verification
async function updateHeartbeat(username, token, addresses = []) {
  const record = await verifyToken(username, token);
  const normalized = record.username;

  record.last_seen = new Date().toISOString();
  if (Array.isArray(addresses) && addresses.length > 0) {
    record.addresses = addresses;
  }

  const userKey = `murmur:user:${normalized}`;
  await kvCommand('SET', userKey, JSON.stringify(record));

  const { token_hash, ...cleanRecord } = record;
  return cleanRecord;
}

// Release handle with token verification
async function releaseUser(username, token) {
  const record = await verifyToken(username, token);
  const normalized = record.username;

  const userKey = `murmur:user:${normalized}`;
  const peerKey = `murmur:peer:${record.peer_id}`;

  await kvCommand('DEL', userKey, peerKey);
  try {
    await kvCommand('SREM', 'murmur:peers_index', normalized);
  } catch {}

  return { ok: true, released: normalized };
}

// List peers without token_hash
async function listPeers(limit = 50) {
  const maxLimit = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 100);
  const peers = [];

  // Check peer index
  try {
    const members = await kvCommand('SMEMBERS', 'murmur:peers_index');
    if (Array.isArray(members) && members.length > 0) {
      for (const name of members.slice(0, maxLimit)) {
        try {
          const peer = await lookupUser(name);
          if (peer) peers.push(peer);
        } catch {}
      }
      if (peers.length > 0) return peers;
    }
  } catch {}

  // Fallback: scan user keys
  try {
    const keys = await kvCommand('KEYS', 'murmur:user:*');
    if (Array.isArray(keys)) {
      for (const k of keys.slice(0, maxLimit)) {
        try {
          const raw = await kvCommand('GET', k);
          if (raw) {
            const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
            const { token_hash, ...clean } = parsed;
            peers.push(clean);
          }
        } catch {}
      }
    }
  } catch {}

  return peers;
}

// ==========================================================================
// 6. LEGACY DATA AUDIT (INSPECTION ONLY - DOES NOT DELETE OR REWRITE)
// ==========================================================================
async function auditLegacyData() {
  const keys = await kvCommand('KEYS', 'murmur:user:*');
  const results = {
    total_keys: Array.isArray(keys) ? keys.length : 0,
    valid_keys: [],
    missing_token_hash: [],
    invalid_username_rule: [],
  };

  if (!Array.isArray(keys) || keys.length === 0) {
    return results;
  }

  for (const k of keys) {
    const rawUsername = k.replace(/^murmur:user:/, '');
    let isValidUsername = false;
    try {
      normalizeUsername(rawUsername);
      isValidUsername = true;
    } catch {
      isValidUsername = false;
    }

    let record = null;
    try {
      const rawVal = await kvCommand('GET', k);
      record = typeof rawVal === 'string' ? JSON.parse(rawVal) : rawVal;
    } catch {}

    const hasTokenHash = Boolean(record && record.token_hash);

    const info = {
      key: k,
      username: rawUsername,
      has_token_hash: hasTokenHash,
      valid_username: isValidUsername,
      record: record ? { ...record, token_hash: hasTokenHash ? '[EXISTS]' : '[MISSING]' } : null,
    };

    if (!isValidUsername) {
      results.invalid_username_rule.push(info);
    }
    if (!hasTokenHash) {
      results.missing_token_hash.push(info);
    }
    if (isValidUsername && hasTokenHash) {
      results.valid_keys.push(info);
    }
  }

  return results;
}

// Helper: Map RegistryError codes to HTTP status codes for handlers
function mapErrorToStatus(err) {
  if (err && err.code) {
    switch (err.code) {
      case 'INVALID':
        return 400;
      case 'UNAUTHORIZED':
        return 401;
      case 'NOT_FOUND':
        return 404;
      case 'TAKEN':
        return 409;
      case 'UNAVAILABLE':
        return 503;
      default:
        return 500;
    }
  }
  return 500;
}

module.exports = {
  RegistryError,
  StorageUnavailableError,
  normalizeUsername,
  validateUsername,
  validatePeerId,
  isUsernameAvailable,
  registerUser,
  verifyToken,
  lookupUser,
  updateHeartbeat,
  releaseUser,
  listPeers,
  auditLegacyData,
  mapErrorToStatus,
  kvCommand,
  hasUpstashConfig,
  resetClient,
};
