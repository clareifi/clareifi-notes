# Security Policy

## Our Commitment

Clareifi Notes is built on a zero-knowledge architecture. The security guarantee is architectural, not a policy promise: the server is structurally incapable of reading user content. No keys, no plaintext, ever.

> *"A platform where it's architecturally impossible for your most sensitive work to be accessed, leaked, or scraped by an LLM-training server without your explicit, encrypted consent."*

We take security reports seriously and will respond promptly.

---

## Reporting a Vulnerability

**Do not open a public GitHub issue for security vulnerabilities.**

Please report security issues to: **security@clareifi.com**

**Response commitment:**
- Acknowledgement within **48 hours**
- Status update within **7 days**
- Fix timeline communicated before public disclosure

We practise responsible disclosure and will work with reporters to coordinate timing. Credit is given to reporters who follow responsible disclosure.

---

## Cryptographic Primitives

| Function | Algorithm | Implementation |
|----------|-----------|---------------|
| Symmetric encryption | **AES-GCM** (256-bit key) | Web Crypto API (native browser) |
| Key derivation | **PBKDF2** | Web Crypto API (native browser) |
| Random number generation | CSPRNG | `crypto.getRandomValues()` |
| Future (Phase 2+) | Argon2id | Via WebAssembly |

**Why Web Crypto API?** Native browser cryptography with zero external dependencies. The implementation is maintained by browser vendors, is subject to constant scrutiny, and does not introduce supply-chain risk from third-party libraries.

---

## Key Security Properties

### Zero-Knowledge Architecture
The server holds only encrypted ciphertext. It has no keys and no capability to decrypt. A server breach exposes only binary blobs that are meaningless without the user's local key.

### Local Key Derivation
User passwords are never transmitted. PBKDF2 derives two values locally:
1. An auth hash (sent to Supabase for authentication only)
2. A master encryption key (stays on-device, never transmitted)

### Nonce Uniqueness
Every encryption operation uses a cryptographically random nonce. Nonce reuse — which would compromise AES-GCM security — is prevented by construction.

### On-Device AI
The Transformers.js integration performs all AI operations locally. No note content is ever transmitted to an AI service or external API for any reason.

---

## Known Limitations

| Limitation | Status | Planned Resolution |
|-----------|--------|--------------------|
| PBKDF2 vs Argon2id | PBKDF2 is less memory-hard than Argon2id | Phase 2: upgrade to Argon2id via WASM |
| No forward secrecy at rest | Key rotation not yet implemented | Phase 2 |
| Metadata visible to server | Note IDs and timestamps are unencrypted | Phase 3: metadata minimisation |
| Single master key | Per-note keys not yet implemented | Phase 3 |

---

## Security Roadmap

| Phase | Security Work |
|-------|--------------|
| Phase 1 (now) | AES-GCM via Web Crypto API, PBKDF2 key derivation, local-first auth |
| Phase 2 | Argon2id upgrade, key rotation, CRDT sync security review |
| Phase 3 | Metadata minimisation, ephemeral sharing key management, audit |

---

## Dependencies

| Dependency | Purpose | Security Notes |
|-----------|---------|---------------|
| Web Crypto API | Encryption / key derivation | Native browser — no supply chain risk |
| Supabase | Auth + encrypted relay | Sees auth hash + ciphertext only |
| Vercel | Edge hosting | No user data processed at edge |
| SvelteKit | Frontend framework | No crypto responsibilities |
| Transformers.js | On-device AI | No data transmitted |
| Yjs / Automerge | CRDT sync | Handles encrypted deltas only |

---

## Scope

When reporting vulnerabilities, the following are in scope:

- Encryption implementation flaws
- Key derivation weaknesses
- Data leakage to the server (any plaintext reaching Supabase)
- Authentication bypasses
- Client-side vulnerabilities that expose the master key

Out of scope (for now — Phase 1 is a learning build):
- Denial of service
- Rate limiting
- Social engineering

---

*Last updated: March 2026 — Phase 1, Week 1*
