# Clareifi Notes — Roadmap

> This roadmap reflects current thinking and will evolve as the build progresses. All decisions are documented in GitHub as they're made.

## Current Phase: Phase 2 — Month 2

---

## 3-Month Build Roadmap

*Security-first architecture. Each phase builds the trust layer before the experience layer.*

---

### ✅ Month 1: The Secure Bunker — Foundation `COMPLETE`

**Focus: Data integrity and local encryption.**

The bunker exists before anything else. Encryption is not a feature added at the end — it is the first thing built, and everything else is layered on top.

**Deliverables:**

- ✅ **Vault Structure** — IndexedDB local-only storage via `idb-keyval`. Encrypted blobs stored natively — no serialisation needed
- ✅ **Cryptography Implementation** — Web Crypto API with AES-GCM 256-bit. PBKDF2 key derivation (310,000 iterations, SHA-256). All notes encrypted on-device before storage
- ✅ **Identity Management** — Local-first vault auth flow: password derives a non-extractable `CryptoKey` and a separate verification hash. The master key never leaves memory and is never persisted

**What this phase proved:** The encryption layer is the foundation, not an afterthought. DevTools → IndexedDB shows only encrypted blobs — no plaintext, no keys, nothing readable.

**Working prototype:** SvelteKit 2 + Svelte 5 (runes) · Web Crypto API · idb-keyval · Tailwind CSS 4

---

### Month 2: The Sync & Relay Layer — Connectivity

**Focus: Reliability without compromising privacy.**

The server is an "encrypted postman." It stores and moves binary blobs. It has no keys. It cannot decrypt. Sync and privacy are not in tension — the architecture makes privacy the only possible outcome.

**Deliverables:**

- **CRDT Integration** — Implement **Yjs** or **Automerge** for conflict-free synchronisation across devices (mobile, desktop)
- **The "Blind" Sync** — Design the server as a pure encrypted relay: it accepts, stores, and routes binary blobs without any capability to read them
- **Performance Optimisation** — Efficient data chunking so that syncing large libraries stays snappy on mobile

**What this phase proves:** Multi-device sync is achievable without the server ever seeing your content.

---

### Month 3: The Public Bridge — Distribution

**Focus: Selective sharing and on-device AI.**

**Deliverables:**

- **Encrypted Sharing Engine** — "Public Profile" feature: users generate ephemeral, end-to-end encrypted links for specific notes or collections
- **Web-Native Encrypted Viewer** — Public-facing view that decrypts content only once the authorised viewer provides the correct access token. Even the developer cannot read what is being shared
- **On-Device AI Integration** — Deploy a lightweight local LLM via **Transformers.js** for note summarisation and search. Zero bytes leave the device

**What this phase proves:** AI assistance is possible inside a zero-knowledge architecture without breaking it. Your notes can be searchable and summarisable without ever reaching a server.

---

## Build-in-Public Milestones

*Timed to the roadmap. The goal is to show the work under the hood — not just the product.*

| Weeks | What to Share | Status |
|-------|---------------|--------|
| 1–4 | The "Encryption First" decision — why Web Crypto API, why AES-GCM, what zero-knowledge means in practice | ✅ Done |
| 5–8 | The "Blind Sync" architecture — visualise how the server sees only encrypted blobs, never content | In progress |
| 9–12 | The first successful "Public Share" of an encrypted note — demonstrating that even the developer cannot read what is being shared | Upcoming |

**Platforms:** Bluesky, Threads, X, Blog (clareifi.com), Paragraph (Dev Stack updates)

---

## Phase 2 — Portfolio (Months 4–8)

*Working product. Open source. Community.*

| Goal | Description |
|------|-------------|
| Working MVP | End-to-end encrypted notes, syncing, and sharing — usable by real people |
| Open Source | Code is public, architecture is documented, contributions welcome |
| Portfolio | Demonstrates practical E2EE implementation for prospective collaborators |

---

## Phase 3 — SaaS (Months 9–12)

*Sustainable indie business. Privacy as the business model.*

| Goal | Description |
|------|-------------|
| SaaS Launch | Hosted version with tiered pricing |
| Encrypted Sharing | Polished Public Profile and ephemeral link sharing |
| On-Device AI | Stable local LLM integration across devices |

**Pricing direction (subject to change):**

| Tier | Price | Includes |
|------|-------|---------| 
| Free | $0 | Local vault, single device |
| Personal | $5–8/mo | Multi-device sync, encrypted sharing |
| Professional | $15–20/mo | Team features, priority support |
| Enterprise | Custom | Custom deployment, audit logs |

---

## Success Metrics

| Phase | Metric | Target |
|-------|--------|--------|
| Phase 1 | Working local vault with E2EE | ✅ Complete — prototype confirmed working |
| Phase 2 | Syncing across 2+ devices | No plaintext ever on server |
| Phase 3 | Paying customers | Sustainable without VC |

---

*Last updated: March 2026 — Phase 1 complete, entering Month 2*
