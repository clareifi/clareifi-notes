# Clareifi Notes — Architecture

> This document describes the technical architecture of Clareifi Notes. It will be updated as decisions are made and revised during the build.

---

## System Overview

```
┌─────────────────────────────────────────────────────────┐
│                      User Device                        │
│                                                         │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────┐  │
│  │  SvelteKit   │───▶│  Web Crypto  │───▶│IndexedDB │  │
│  │     UI       │    │  API (AES-   │    │  Vault   │  │
│  │              │    │    GCM)      │    │ (local)  │  │
│  └──────────────┘    └──────────────┘    └──────────┘  │
│          │                                              │
│  ┌───────────────┐                                      │
│  │ Transformers  │  ← On-device AI (no data leaves)     │
│  │     .js       │                                      │
│  └───────────────┘                                      │
└─────────────────────────────────────────────────────────┘
          │
          │  Encrypted blobs only (server is blind)
          ▼
┌─────────────────────────────────────────────────────────┐
│                  Supabase (Blind Relay)                  │
│                                                         │
│   Accepts · Stores · Routes encrypted blobs             │
│   No keys · No decryption capability · No content       │
└─────────────────────────────────────────────────────────┘
          │
          ▼
      Vercel Edge
```

**The core constraint:** The server is structurally incapable of reading user content. This is enforced by architecture, not by policy.

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Frontend | SvelteKit + TypeScript | Reactive UI, type-safe throughout |
| Encryption | **Web Crypto API (AES-GCM)** | Native browser crypto, zero external dependencies |
| Key Derivation | PBKDF2 (Web Crypto API) | Password → local key; server never sees credentials |
| Local Storage | IndexedDB (idb-keyval) | High-performance, async, local-first storage |
| Sync | Yjs / Automerge (CRDT) | Conflict-free multi-device synchronisation |
| Backend | Supabase | Blind encrypted relay + auth scaffolding |
| Deployment | Vercel | Edge-optimised hosting |
| On-device AI | **Transformers.js** | Local LLM for search/summarise; zero server contact |

---

## Encryption Architecture

### Key Derivation Flow

```
User Password
      │
      ▼
  PBKDF2 (Web Crypto API)
      │
      ├──▶  Auth Hash  →  Supabase auth (server never sees raw password)
      │
      └──▶  Master Key  →  Stored locally only, never transmitted
                │
                ▼
           AES-GCM Encryption
                │
                ▼
         Encrypted Note Blob  →  IndexedDB (local) + Supabase (sync relay)
```

### Encryption / Decryption

All encryption and decryption happens on the user's device using the browser's native **Web Crypto API**:

- **Algorithm:** AES-GCM (256-bit key)
- **Nonces:** Cryptographically random, unique per operation
- **Key storage:** Derived from password at session start; never persisted to disk or transmitted

```typescript
// Encrypt a note (conceptual — implementation in progress)
async function encryptNote(content: string, masterKey: CryptoKey): Promise<EncryptedBlob> {
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(content);
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce },
    masterKey,
    encoded
  );
  return { nonce, ciphertext };
}

// Decrypt a note
async function decryptNote(blob: EncryptedBlob, masterKey: CryptoKey): Promise<string> {
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: blob.nonce },
    masterKey,
    blob.ciphertext
  );
  return new TextDecoder().decode(plaintext);
}
```

---

## Data Model

### EncryptedNote (TypeScript interface)

```typescript
interface EncryptedNote {
  id: string;           // UUID, public
  userId: string;       // UUID, public
  nonce: Uint8Array;    // Random, unique per note — public
  ciphertext: ArrayBuffer; // Encrypted content — server sees only this
  createdAt: string;    // ISO timestamp, public
  updatedAt: string;    // ISO timestamp, public
  // NO plaintext fields ever reach the server
}
```

### Database Schema (Supabase — stores encrypted blobs only)

```sql
-- Notes table: the server sees metadata and ciphertext only
CREATE TABLE notes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID REFERENCES profiles(id) NOT NULL,
  nonce      BYTEA NOT NULL,      -- Random nonce for AES-GCM
  ciphertext BYTEA NOT NULL,      -- Encrypted content blob
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
  -- No title, no tags, no plaintext — by design
);

CREATE TABLE profiles (
  id         UUID REFERENCES auth.users PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Sync Architecture (Month 2)

The sync layer uses **CRDT** (Conflict-free Replicated Data Types) via **Yjs** or **Automerge** to enable conflict-free multi-device sync without a centralised resolution server.

**The "Blind Sync" model:**

1. Device A encrypts a note update → produces an encrypted CRDT delta
2. Delta (binary blob) is sent to Supabase relay
3. Supabase stores and routes the blob to Device B
4. Device B receives the blob, decrypts locally, merges the CRDT state

At no point does the server understand what it is routing. It is an encrypted postman.

---

## On-Device AI (Month 3)

**Transformers.js** runs a lightweight local language model directly in the browser via WebAssembly. No data leaves the device.

Use cases:
- Semantic search across encrypted notes (decrypt locally → embed locally → search locally)
- Note summarisation on demand
- Tag suggestions

This allows AI-powered features inside a zero-knowledge architecture without compromising the privacy guarantee.

---

## Privacy Boundary

| Data | Where it lives | Server can read? |
|------|---------------|-----------------|
| Note content | Encrypted on device, encrypted blob on server | ❌ Never |
| Note metadata (id, timestamps) | Server | ✅ Yes (by design) |
| Master key | Device memory only (session) | ❌ Never |
| Password | Never stored anywhere | ❌ Never |
| Auth hash | Supabase auth | ✅ Yes (hashed) |
| AI embeddings | Device only | ❌ Never |

---

## Security Threat Model

| Threat | Mitigation |
|--------|-----------|
| Server breach | Ciphertext only — no keys, no plaintext |
| Man-in-the-middle | TLS + content already encrypted before transit |
| Compromised Supabase | Encrypted blobs are meaningless without local key |
| LLM training scraping | Server cannot read content; on-device AI never transmits |
| Weak password | PBKDF2 key stretching; future: Argon2id via WASM |
| Nonce reuse | Cryptographically random nonces, enforced per operation |

---

## Performance Targets

| Operation | Target |
|-----------|--------|
| Note encryption | < 10ms |
| Local search (Transformers.js) | < 500ms |
| Sync delta transmission | < 200ms |
| Cold start (SvelteKit) | < 1s |

---

*Last updated: March 2026 — Phase 1, Week 1*
