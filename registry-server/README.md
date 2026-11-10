# Murmur Global P2P Registry Server

High-performance, serverless global identity & peer discovery registry for **Murmur** (built on `rustp2p-quic`).

Deployed at **`https://murmur.debyte.space`** on **Vercel**.

---

## 🎨 Visual Identity & Frontend

* **Theme**: Citrus Pop
* **Palette**:
  * `#B7FF3C` — Electric Lime / Citrus Green
  * `#1E1F26` — Deep Obsidian / Slate Dark
  * `#FFFFFF` — Crisp White
  * `#FFB703` — Punchy Tangerine Amber
  * `#2EC4B6` — Vibrant Cyan / Turquoise
* **Aesthetic**: Energetic, tactile editorial design with high contrast, authentic Ratatui TUI simulation, live global handle availability checker, and zero generic AI slop.

---

## 🚀 Quick Deployment to Vercel

### Option 1: Via Vercel CLI
```bash
cd /home/debyte/projects/murmur/Murmur/registry-server
vercel
# When prompted, select production deployment or:
vercel --prod
```

### Option 2: Via Git / GitHub
1. Push this repository to GitHub.
2. In your Vercel Dashboard, click **New Project** and select this repository.
3. Set the **Root Directory** to `registry-server`.
4. Deploy!

### Subdomain Setup (`murmur.debyte.space`)
1. In your Vercel project dashboard, go to **Settings** → **Domains**.
2. Add `murmur.debyte.space`.
3. Add the generated DNS CNAME or A record in your DNS provider (e.g. Cloudflare / Namecheap) for `debyte.space`:
   * **Type**: `CNAME`
   * **Name**: `murmur`
   * **Value**: `cname.vercel-dns.com`

---

## 💾 Storage Backend: Upstash Redis

The registry server uses **Upstash Redis** for globally synchronized, ultra-fast serverless key-value persistence.

### Setting Up Upstash on Vercel:
1. Create a free Redis database at [console.upstash.com](https://console.upstash.com) (or via the Vercel Integrations tab).
2. Under the **REST API** tab, copy the **`UPSTASH_REDIS_REST_URL`** and **`UPSTASH_REDIS_REST_TOKEN`**.
3. In your Vercel Project settings (**Settings** → **Environment Variables**), add:
   * `UPSTASH_REDIS_REST_URL`
   * `UPSTASH_REDIS_REST_TOKEN`
4. That's it! If credentials are not set (e.g. running locally offline), the server automatically falls back to an in-memory store pre-seeded with `@debyte`, `@alice`, and `@neo`.

---

## 📡 REST API Reference

All endpoints return CORS headers allowing cross-origin requests from any client.

### 1. Check Handle Availability
```http
GET /api/check?username=debyte
```
**Response:**
```json
{
  "ok": true,
  "username": "debyte",
  "available": false,
  "message": "Username '@debyte' is already taken."
}
```

### 2. Register Global Handle
```http
POST /api/register
Content-Type: application/json

{
  "username": "alice",
  "nodeId": "0x10000002",
  "addresses": ["quic://peer-eu.debyte.space:9001"],
  "pubkey": "ed25519:616c6963657032706e6f646530326b6579303032",
  "bio": "Validator Node - Frankfurt"
}
```

### 3. Lookup Peer Info
```http
GET /api/lookup?username=alice
```
**Response:**
```json
{
  "ok": true,
  "peer": {
    "username": "alice",
    "node_id": "0x10000002",
    "addresses": ["quic://peer-eu.debyte.space:9001"],
    "pubkey": "ed25519:...",
    "registered_at": "2026-11-03T12:00:00.000Z",
    "last_seen": "2026-11-10T10:00:00.000Z"
  }
}
```

### 4. Bootstrap Peer List
```http
GET /api/peers?limit=20
```

### 5. Health Status
```http
GET /api/health
```

---

## 💻 Local Testing
```bash
npm start
# Server starts at http://localhost:3000
```
