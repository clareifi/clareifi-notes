# Clareifi Notes

Privacy-first knowledge management with end-to-end encryption. Built in public.

**Live:** [clareifi.xyz](https://clareifi.xyz)

---

## What It Is

A zero-knowledge encrypted notes app. Your vault is unlocked with a password-derived key that never leaves your device. The server never sees your plaintext — ever.

**"Privacy by Architecture, not policy."**

---

## Current Status — Phase 2 Complete (April 2026)

### Phase 1 — Local-first E2EE ✅

- Password-derived AES-GCM 256-bit encryption (PBKDF2, 310,000 iterations)
- Zero-knowledge vault — master key is non-extractable, never leaves the client
- IndexedDB local storage via idb-keyval
- Encrypted note titles
- Setup → Unlock → Create → Edit → Delete note flow

### Phase 2 — Supabase Sync + Auth ✅

- Email/password authentication via Supabase Auth
- Zero-knowledge sync — server stores only ciphertext
- Salt-based key derivation (unique per vault)
- Multi-device support (tested across 6 browsers on 2 devices)
- Vault config + notes schema with row-level security

### Phase 3 — Production SaaS (Planned)

- Key rotation with envelope key architecture
- Public profile pages
- Selective sharing with encrypted links
- External security audit
- Mobile apps

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | SvelteKit 2 + Svelte 5 + TypeScript |
| Encryption | Web Crypto API (AES-GCM 256-bit, PBKDF2) |
| Backend | Supabase (auth, sync, RLS) |
| Storage | IndexedDB (local) + Supabase (cloud) |
| Styling | Tailwind CSS 4 |
| Deployment | Vercel |

---

## Security

All encryption happens client-side. The server stores only ciphertext.

- Master key derived from password via PBKDF2 (310,000 iterations, SHA-256)
- AES-GCM 256-bit encryption with a unique IV per note
- Non-extractable CryptoKey — the key cannot be exported from memory
- Auth verification uses a cryptographically independent hash (salt variant)
- Zero-knowledge sync — Supabase never sees plaintext

> Phase 2 learning project. Not recommended for sensitive data until a formal security audit is completed.
>
> Security issues: security@clareifi.com

---

## Building in Public

Follow the development journey:

- 🦋 Bluesky: [@clareifi.com](https://bsky.app/profile/clareifi.com)
- 🧵 Threads: [@clareifi](https://threads.net/@clareifi)

---

## License

MIT © 2026 Clareifi

---

*Build things worth keeping. Document things worth remembering. Leave things better than you found them.*
