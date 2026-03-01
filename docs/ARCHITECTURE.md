# Clareifi Notes — Technical Architecture

> This document evolves as the project develops. All major technical decisions are documented here with rationale. Last updated: March 2025.

## Design Principles

1. **Privacy by Default** — Encryption happens client-side before data leaves the device
2. **Zero-Knowledge Server** — Backend cannot decrypt user data under any circumstances
3. **Local-First** — Application works offline, syncs opportunistically
4. **Simplicity Over Features** — Every feature must justify its added complexity
5. **No Roll-Your-Own Crypto** — Use well-audited, industry-standard libraries only

---

## System Architecture

```
┌──────────────────────────────────┐
│           User Browser           │
│  ┌────────────────────────────┐  │
│  │      SvelteKit App         │  │  ← UI Layer
│  └──────────────┬─────────────┘  │
│                 │                │
│  ┌──────────────▼─────────────┐  │
│  │     Encryption Layer       │  │  ← libsodium.js (client-side only)
│  │   (libsodium.js / WASM)    │  │
│  └──────────────┬─────────────┘  │
│                 │                │
│  ┌──────────────▼─────────────┐  │
│  │   IndexedDB (idb-keyval)   │  │  ← Local-first storage
│  └──────────────┬─────────────┘  │
└─────────────────┼────────────────┘
                  │  HTTPS only
                  │
┌─────────────────▼────────────────┐
│            Supabase              │
│   Auth │ PostgreSQL │ Storage    │  ← Encrypted blobs only
└──────────────────────────────────┘
                  │
┌─────────────────▼────────────────┐
│             Vercel               │  ← Edge deployment
└──────────────────────────────────┘
```

---

## Technology Stack

### Frontend
| Technology | Version | Rationale |
|------------|---------|-----------|
| SvelteKit | 2.x | Lean, fast, excellent DX; less boilerplate than React; great AI tool support |
| libsodium.js | Latest | Industry-standard crypto; WebAssembly performance; well-audited |
| idb-keyval | Latest | Simple IndexedDB wrapper for local-first storage |
| Tiptap | 2.x | Extensible headless editor with markdown support (TBD vs CodeMirror) |

### Backend
| Technology | Rationale |
|------------|-----------|
| Supabase | All-in-one: auth + PostgreSQL + file storage + realtime; open source; generous free tier |
| Vercel | Zero-config SvelteKit deployment; edge functions for public profiles |

### Development
| Tool | Purpose |
|------|---------|
| Claude Code / Cursor | AI-assisted development |
| GitHub Actions | CI/CD (Phase 2) |
| Vitest + Playwright | Testing (Phase 2) |
| Sentry | Error monitoring (Phase 3) |
| Plausible | Privacy-respecting analytics (Phase 3) |

---

## Data Models

### Client-Side (Encrypted)
```typescript
interface EncryptedNote {
  id: string;                    // UUID, non-sensitive
  encrypted_blob: Uint8Array;    // Content + metadata, encrypted with master key
  nonce: Uint8Array;             // Unique per encryption operation
  created_at: number;            // Unix timestamp
  updated_at: number;            // Unix timestamp
  sync_status: 'local' | 'synced' | 'conflict';
}
```

### Server-Side (PostgreSQL — zero-knowledge)
```sql
-- Notes: server sees only encrypted bytes
CREATE TABLE notes (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID REFERENCES auth.users ON DELETE CASCADE,
  blob        BYTEA NOT NULL,   -- Encrypted content
  nonce       BYTEA NOT NULL,   -- Encryption nonce
  size_bytes  INTEGER NOT NULL, -- For storage quota enforcement
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  deleted_at  TIMESTAMPTZ       -- Soft delete
);

-- Public profiles (unencrypted by design)
CREATE TABLE profiles (
  user_id      UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  username     TEXT UNIQUE NOT NULL,
  display_name TEXT,
  bio          TEXT,
  avatar_url   TEXT,
  is_public    BOOLEAN DEFAULT FALSE,
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Share links (Phase 2)
CREATE TABLE shares (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  note_id             UUID REFERENCES notes ON DELETE CASCADE,
  share_key           TEXT UNIQUE NOT NULL,        -- URL token
  encrypted_note_key  BYTEA NOT NULL,              -- Separately keyed
  expires_at          TIMESTAMPTZ,
  view_count          INTEGER DEFAULT 0,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Encryption Architecture

### Key Derivation Flow
```
User Password
     │
     ▼
Argon2id (libsodium: crypto_pwhash)
  - opslimit: SENSITIVE
  - memlimit: SENSITIVE
  - algo: Argon2id
     │
     ├──▶ Auth Hash → sent to Supabase for authentication
     │              (server NEVER sees the password itself)
     │
     └──▶ Master Key (32 bytes) → stays in memory only, NEVER leaves client
               │
               ▼
         Encrypts/decrypts all vault content
```

### Per-Note Encryption
```typescript
// Each note gets a unique nonce — never reuse nonces
function encryptNote(plaintext: string, masterKey: Uint8Array): EncryptedNote {
  const nonce = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES);
  const blob  = sodium.crypto_secretbox_easy(
    sodium.from_string(plaintext),
    nonce,
    masterKey
  );
  return { blob, nonce };
}

function decryptNote(blob: Uint8Array, nonce: Uint8Array, masterKey: Uint8Array): string {
  const plaintext = sodium.crypto_secretbox_open_easy(blob, nonce, masterKey);
  return sodium.to_string(plaintext);
}
```

### Key Management (Phase 1)
- **Strategy:** Password-derived keys only — simple, no key storage needed
- **Tradeoff:** Lost password = lost data (acceptable for Phase 1 learning)
- **Phase 2 addition:** Optional recovery phrase stored as encrypted key backup

---

## Public / Private Boundary

| Content | Encrypted? | Stored Where |
|---------|-----------|--------------|
| Personal vault notes | ✅ Yes (master key) | Supabase (encrypted blob) |
| File attachments | ✅ Yes (master key) | Supabase Storage (encrypted) |
| Share link content | ✅ Yes (share key ≠ master key) | Supabase (separate key) |
| Public profile (bio, links) | ❌ No (by design) | Supabase profiles table |
| Avatar images | ❌ No (by design) | Supabase Storage (public bucket) |

**Critical rule:** Share keys must be cryptographically independent from the master key.

---

## Sync Strategy

### Phase 1: Simple Cloud Backup
- Encrypt full note locally → upload blob to Supabase
- Last-write-wins conflict resolution
- User manually resolves conflicts via UI

### Phase 2: CRDT Sync (TBD)
- Evaluate Yjs or Automerge for real-time collaboration
- E2EE CRDT is complex — research needed before committing

---

## Security Threat Model

### In Scope
| Threat | Mitigation |
|--------|-----------|
| Server compromise | Zero-knowledge: server holds only encrypted blobs |
| Network eavesdropping | HTTPS + E2EE |
| Data breach | All personal content encrypted at rest |
| Weak passwords | Enforce minimums; Argon2id makes brute-force expensive |
| XSS attacks | CSP headers; sanitise all user input |

### Out of Scope (Phase 1)
- Client-side malware / keyloggers (OS-level concern)
- Physical device access (assume OS encryption)
- Sophisticated timing attacks (beyond MVP scope)

### Attack Surface Summary
| Surface | Risk Level | Phase 1 Mitigation |
|---------|-----------|-------------------|
| Password strength | High | Enforce 12+ chars; zxcvbn scoring |
| XSS | High | CSP headers; DOMPurify |
| Key derivation params | Medium | Argon2id SENSITIVE preset |
| Share link exposure | Medium | Optional expiry; revocation |
| Encrypted metadata leak | Low | Minimal unencrypted metadata |

---

## Performance Targets

| Metric | Phase 1 Target | Phase 3 Target |
|--------|---------------|---------------|
| First contentful paint | < 1.5s | < 1s |
| Note encrypt/decrypt | < 100ms | < 50ms |
| Local search (1k notes) | < 500ms | < 200ms |
| API response time (p95) | n/a | < 200ms |
| Uptime | n/a | 99.9% |

---

## Open Questions

1. **Sync conflicts:** Last-write-wins vs manual resolution vs CRDT?
2. **Search:** Client-side index only, or explore encrypted search indexes?
3. **Key rotation:** Support password change without full re-encryption?
4. **Mobile:** PWA sufficient long-term, or native apps needed?
5. **File size limits:** Max encrypted blob size per note?

---

*Architecture decisions are logged in the Obsidian developer journal. This document reflects the current agreed approach.*
