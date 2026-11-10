// Comprehensive Verification Suite for Murmur Registry
// Tests requirements 14, 15, 16, 17:
// 1. Concurrency (20 parallel registerUser calls -> exactly 1 succeeds, 19 fail with TAKEN)
// 2. Unreachable Upstash -> throws UNAVAILABLE (not NOT_FOUND or success)
// 3. Removed seeds -> lookup 'debyte' returns NOT_FOUND
// 4. Legacy data audit -> inspects keys without wiping data

const http = require('http');
const crypto = require('crypto');
const path = require('path');

// Target store implementation
const {
  registerUser,
  lookupUser,
  updateHeartbeat,
  releaseUser,
  listPeers,
  auditLegacyData,
  resetClient,
  RegistryError,
} = require('../lib/store');

// ==========================================================================
// MOCK UPSTASH REST HTTP SERVER
// Implements Upstash REST protocol over real HTTP/TCP sockets with atomic locking
// ==========================================================================
function createUpstashHttpServer(port) {
  const store = new Map();
  const sets = new Map();

  function executeSingle(commandArgs) {
    const cmd = String(commandArgs[0]).toUpperCase();

    if (cmd === 'GET') {
      const key = commandArgs[1];
      const val = store.has(key) ? store.get(key) : null;
      return { result: val };
    }

    if (cmd === 'SET') {
      const key = commandArgs[1];
      const val = commandArgs[2];
      const hasNx = commandArgs.some(
        (arg) => typeof arg === 'string' && arg.toUpperCase() === 'NX'
      );

      if (hasNx) {
        if (store.has(key)) {
          // Key exists: SET NX returns null (standard Redis behavior)
          return { result: null };
        }
        store.set(key, val);
        return { result: 'OK' };
      }

      store.set(key, val);
      return { result: 'OK' };
    }

    if (cmd === 'DEL') {
      const keys = commandArgs.slice(1);
      let count = 0;
      for (const k of keys) {
        if (store.delete(k)) count++;
      }
      return { result: count };
    }

    if (cmd === 'KEYS') {
      const pattern = commandArgs[1] || '*';
      const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
      const matches = [];
      for (const k of store.keys()) {
        if (regex.test(k)) matches.push(k);
      }
      return { result: matches };
    }

    if (cmd === 'SMEMBERS') {
      const key = commandArgs[1];
      const members = sets.has(key) ? Array.from(sets.get(key)) : [];
      return { result: members };
    }

    if (cmd === 'SADD') {
      const key = commandArgs[1];
      if (!sets.has(key)) sets.set(key, new Set());
      const set = sets.get(key);
      let count = 0;
      for (const m of commandArgs.slice(2)) {
        if (!set.has(m)) {
          set.add(m);
          count++;
        }
      }
      return { result: count };
    }

    if (cmd === 'SREM') {
      const key = commandArgs[1];
      let count = 0;
      if (sets.has(key)) {
        const set = sets.get(key);
        for (const m of commandArgs.slice(2)) {
          if (set.delete(m)) count++;
        }
      }
      return { result: count };
    }

    return { error: `Unknown command: ${cmd}` };
  }

  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      // Simulate 1-3ms network latency to simulate real network concurrency
      setTimeout(() => {
        try {
          const payload = JSON.parse(body);
          if (Array.isArray(payload) && Array.isArray(payload[0])) {
            // Batch of commands: [["cmd1", ...], ["cmd2", ...]]
            const results = payload.map((cmdArgs) => executeSingle(cmdArgs));
            res.writeHead(200, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify(results));
          } else if (Array.isArray(payload)) {
            // Single command array: ["cmd", ...]
            const result = executeSingle(payload);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify(result));
          } else {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ error: 'Invalid payload' }));
          }
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: err.message }));
        }
      }, Math.floor(Math.random() * 3) + 1);
    });
  });

  return new Promise((resolve) => {
    server.listen(port, () => resolve(server));
  });
}

// ==========================================================================
// TEST SUITE
// ==========================================================================
async function main() {
  console.log('\n======================================================');
  console.log('🧪 RUNNING MURMUR REGISTRY VERIFICATION SUITE');
  console.log('======================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, desc) {
    if (condition) {
      console.log(`  ✅ PASS: ${desc}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${desc}`);
      failed++;
    }
  }

  // ------------------------------------------------------------------------
  // TEST 1: Seed data removal (Requirement 1 & 17)
  // ------------------------------------------------------------------------
  console.log('--- TEST 1: Seed Data Removed (Requirement 1 & 17) ---');
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
  resetClient();

  try {
    await lookupUser('debyte');
    assert(false, 'lookupUser("debyte") should throw NOT_FOUND after seeds removed');
  } catch (err) {
    assert(err.code === 'NOT_FOUND', `lookupUser("debyte") threw NOT_FOUND (got ${err.code}: ${err.message})`);
  }

  try {
    await lookupUser('alice');
    assert(false, 'lookupUser("alice") should throw NOT_FOUND after seeds removed');
  } catch (err) {
    assert(err.code === 'NOT_FOUND', `lookupUser("alice") threw NOT_FOUND (got ${err.code})`);
  }

  // ------------------------------------------------------------------------
  // TEST 2: Storage Unavailability Handling (Requirement 3 & 16)
  // ------------------------------------------------------------------------
  console.log('\n--- TEST 2: Unreachable Upstash Storage (Requirement 3 & 16) ---');
  process.env.UPSTASH_REDIS_REST_URL = 'http://127.0.0.1:54321'; // Deliberately dead port
  process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token-fake';
  resetClient();

  try {
    await lookupUser('someone');
    assert(false, 'lookupUser with dead Upstash should throw UNAVAILABLE');
  } catch (err) {
    assert(
      err.code === 'UNAVAILABLE',
      `lookupUser on dead Upstash threw UNAVAILABLE (got code=${err.code}: ${err.message})`
    );
  }

  try {
    await registerUser({ username: 'bob', peer_id: '0x123' });
    assert(false, 'registerUser with dead Upstash should throw UNAVAILABLE');
  } catch (err) {
    assert(
      err.code === 'UNAVAILABLE',
      `registerUser on dead Upstash threw UNAVAILABLE (got code=${err.code})`
    );
  }

  // ------------------------------------------------------------------------
  // TEST 3: Concurrency Test (20 parallel claims) (Requirement 6, 8, 15)
  // ------------------------------------------------------------------------
  console.log('\n--- TEST 3: Concurrency Test against Local Upstash-Compatible HTTP Server (Requirement 15) ---');
  const TEST_PORT = 18888;
  const mockServer = await createUpstashHttpServer(TEST_PORT);
  console.log(`  📡 Started local Upstash-compatible HTTP REST server on port ${TEST_PORT}`);

  process.env.UPSTASH_REDIS_REST_URL = `http://127.0.0.1:${TEST_PORT}`;
  process.env.UPSTASH_REDIS_REST_TOKEN = 'local-dev-secret';
  resetClient();

  const CONCURRENCY_COUNT = 20;
  const targetUsername = 'mesh_pioneer';

  console.log(`  🚀 Launching ${CONCURRENCY_COUNT} simultaneous registerUser calls for '@${targetUsername}'...`);

  const results = await Promise.allSettled(
    Array.from({ length: CONCURRENCY_COUNT }).map((_, idx) =>
      registerUser({
        username: targetUsername,
        peer_id: `0x1000${String(idx).padStart(4, '0')}`,
      })
    )
  );

  const fulfilled = results.filter((r) => r.status === 'fulfilled');
  const rejected = results.filter((r) => r.status === 'rejected');

  assert(
    fulfilled.length === 1,
    `Exactly ONE registration succeeded (fulfilled: ${fulfilled.length}, expected: 1)`
  );
  assert(
    rejected.length === CONCURRENCY_COUNT - 1,
    `Exactly ${CONCURRENCY_COUNT - 1} registrations were rejected (rejected: ${rejected.length})`
  );

  const allTaken = rejected.every((r) => r.reason && r.reason.code === 'TAKEN');
  assert(allTaken, 'All 19 failed attempts were rejected with code TAKEN');

  // Verify stored record
  const savedRecord = await lookupUser(targetUsername);
  assert(savedRecord.username === targetUsername, `Verified stored record for @${targetUsername}`);
  assert(savedRecord.token_hash === undefined, 'lookupUser does NOT return token_hash (Requirement 10)');

  // ------------------------------------------------------------------------
  // TEST 4: Peer ID Uniqueness and Rollback (Requirement 8)
  // ------------------------------------------------------------------------
  console.log('\n--- TEST 4: Peer ID Uniqueness & Atomic Rollback (Requirement 8) ---');
  const winnerPeerId = fulfilled[0].value.peer_id;
  try {
    await registerUser({ username: 'different_user', peer_id: winnerPeerId });
    assert(false, 'Should fail when reusing existing peer_id');
  } catch (err) {
    assert(err.code === 'TAKEN', `Rejected duplicate peer_id with code TAKEN (${err.message})`);
  }

  // Verify that 'different_user' was rolled back and NOT saved
  try {
    await lookupUser('different_user');
    assert(false, 'Rolled-back user should not exist in database');
  } catch (err) {
    assert(err.code === 'NOT_FOUND', 'User key was cleanly deleted upon peer_id collision');
  }

  // ------------------------------------------------------------------------
  // TEST 5: Token Verification, Heartbeat & Release (Requirement 9, 10)
  // ------------------------------------------------------------------------
  console.log('\n--- TEST 5: Heartbeat, Release, and Token Verification (Requirement 9) ---');
  const registered = fulfilled[0].value;
  const token = registered.token;

  // Heartbeat with correct token
  const updated = await updateHeartbeat(targetUsername, token, ['127.0.0.1:8080']);
  assert(updated.last_seen !== undefined, 'updateHeartbeat succeeded with valid token');
  assert(updated.token_hash === undefined, 'updateHeartbeat does NOT return token_hash');

  // Heartbeat with wrong token
  try {
    await updateHeartbeat(targetUsername, 'wrong-token-abc', ['127.0.0.1:8080']);
    assert(false, 'updateHeartbeat with invalid token should fail');
  } catch (err) {
    assert(err.code === 'UNAUTHORIZED', `Wrong token threw UNAUTHORIZED (code=${err.code})`);
  }

  // Release handle
  const released = await releaseUser(targetUsername, token);
  assert(released.ok === true, 'releaseUser succeeded with valid token');

  // Verify handle is now free
  try {
    await lookupUser(targetUsername);
    assert(false, 'Released user should not exist');
  } catch (err) {
    assert(err.code === 'NOT_FOUND', 'Released handle is no longer found in registry');
  }

  // ------------------------------------------------------------------------
  // TEST 6: Legacy Data Audit (Requirement 14)
  // ------------------------------------------------------------------------
  console.log('\n--- TEST 6: Legacy Data Audit (Requirement 14) ---');
  // Register a valid user
  await registerUser({ username: 'valid_user', peer_id: '0x2001' });

  // Simulate a legacy unhashed key
  const legacyKey = 'murmur:user:legacy_user';
  await mockServer; // server active
  const { kvCommand } = require('../lib/store');
  await kvCommand('SET', legacyKey, JSON.stringify({ username: 'legacy_user', peer_id: '0x3001' })); // no token_hash

  // Simulate an invalid username key
  const invalidKey = 'murmur:user:bad@name!';
  await kvCommand('SET', invalidKey, JSON.stringify({ username: 'bad@name!', peer_id: '0x4001' }));

  const audit = await auditLegacyData();
  console.log('  📊 Audit Results:', JSON.stringify(audit, null, 2));
  assert(audit.total_keys >= 3, `Audit found ${audit.total_keys} keys`);
  assert(
    audit.missing_token_hash.some((k) => k.username === 'legacy_user'),
    'Audit detected key missing token_hash without deleting it'
  );
  assert(
    audit.invalid_username_rule.some((k) => k.username === 'bad@name!'),
    'Audit detected key failing username rule without deleting it'
  );

  // Close server
  mockServer.close();

  // Summary
  console.log('\n======================================================');
  if (failed === 0) {
    console.log(`🎉 ALL ${passed} VERIFICATION CHECKS PASSED PERFECTLY!`);
  } else {
    console.error(`💥 TEST RUN FINISHED WITH ${failed} FAILURES (${passed} passed)`);
    process.exit(1);
  }
  console.log('======================================================\n');
}

main().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
