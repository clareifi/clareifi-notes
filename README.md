# Clareifi Notes

Privacy-first knowledge management with end-to-end encryption.  
Built in public as part of [The Clareifi Collective](https://clareifi.com).

**Live:** [clareifi.xyz](https://clareifi.xyz)

---

## What It Is

A local-first, zero-knowledge encrypted notes app. Your vault is unlocked 
with a password-derived key that never leaves your device. The server never 
sees your plaintext — ever.

**"Privacy by Architecture, not policy."**

---

## Current Status

Phase 1 — Local-first encrypted notes (shipped March 2026)

- ✅ Password-derived AES-GCM 256-bit encryption (PBKDF2, 310,000 iterations)
- ✅ Zero-knowledge vault — master key is non-extractable, never leaves the client
- ✅ IndexedDB local storage via idb-keyval
- ✅ Setup → Unlock → Create → Edit → Delete note flow
- ✅ SvelteKit 2 + Svelte 5 + TypeScript + Tailwind CSS 4
- ⬜ Cross-device sync (Phase 2)
- ⬜ Public profiles + selective sharing (Phase 2)
- ⬜ Mobile apps (Phase 3)

---

## Tech Stack

- **Framework:** SvelteKit 2 + Svelte 5
- **Encryption:** Web Crypto API (AES-GCM 256-bit, PBKDF2)
- **Storage:** IndexedDB via idb-keyval (local-first)
- **Styling:** Tailwind CSS 4
- **Deployment:** Vercel
- **Future backend:** Supabase (encrypted sync, auth — Phase 2)

---

## Security

All encryption happens client-side. The server stores only ciphertext.

- Master key derived from password via PBKDF2 (310,000 iterations, SHA-256)
- AES-GCM 256-bit encryption with a unique IV per note
- Non-extractable CryptoKey — the key cannot be exported from memory
- Auth verification uses a cryptographically independent hash (salt variant)

**Phase 1 learning project.** Not recommended for sensitive data until a 
formal security audit is completed.

Security issues: security@clareifi.com

---

## Building in Public

Follow the development journey:

- 🦋 Bluesky: [@clareifi.com](https://bsky.app/profile/clareifi.com)
- 🧵 Threads: [@clareifi](https://threads.net/@clareifi)
- 📝 Dev blog: [The Clareifi Dev Stack](https://paragraph.xyz/@clareifi)

---

## License

MIT © 2026 Clareifi

*Build things worth keeping. Document things worth remembering.  
Leave things better than you found them.*
