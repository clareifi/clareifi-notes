# Clareifi Notes

**Privacy-first knowledge management for the AI age**

> A learning project turned portfolio piece turned product — built in public to demonstrate practical implementation of end-to-end encryption in modern web applications.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](docs/CONTRIBUTING.md)
[![Built in Public](https://img.shields.io/badge/Built%20in%20Public-blue)](https://bsky.app/profile/clareifi.com)
[![Phase 1](https://img.shields.io/badge/Phase%201-Complete%20✓-brightgreen)](docs/ROADMAP.md)
[![Phase 2](https://img.shields.io/badge/Phase%202-In%20Progress-yellow)](docs/ROADMAP.md)

---

## Current Status: Phase 1 Complete ✅

The Secure Bunker is built and confirmed working. A fully functional local-first encrypted notes prototype — vault creation, PBKDF2 key derivation, AES-GCM encryption, IndexedDB storage, unlock flow, create / edit / delete notes. The master key lives in memory only and is never persisted.

**Verified:** DevTools → Application → IndexedDB shows only encrypted blobs. No plaintext. No keys. Nothing readable.

**Prototype stack:** SvelteKit 2 · Svelte 5 (runes) · Web Crypto API · idb-keyval · Tailwind CSS 4 · TypeScript

---

## What is Clareifi Notes?

Clareifi Notes is an end-to-end encrypted knowledge management platform that combines the local-first philosophy of Obsidian with the flexibility of modern web applications. Store notes, code, articles, and media with zero-knowledge encryption while maintaining a public profile for selective sharing.

**Core Principles:**
- 🔐 **Privacy by default** — End-to-end encryption for your personal vault
- 🏠 **Local-first** — Your data lives on your device, not on our servers
- 🤖 **Zero-knowledge AI** — On-device intelligence via Transformers.js (Month 3)
- 🌐 **Selective sharing** — Encrypted public links for what you choose to share

## Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Framework | SvelteKit 2 + Svelte 5 | Performance, runes-based reactivity |
| Encryption | Web Crypto API (AES-GCM) | Native browser crypto, zero dependencies |
| Local Storage | IndexedDB (idb-keyval) | High-performance local-first storage |
| Sync | Yjs / Automerge (CRDT) | Conflict-free multi-device sync *(Month 2)* |
| Backend | Supabase | Blind relay — stores encrypted blobs only |
| Deployment | Vercel | Edge-optimised hosting |
| On-device AI | Transformers.js | Local LLM for search/summarise *(Month 3)* |

## Security Architecture

Notes are encrypted on your device using **AES-GCM 256-bit** via the native **Web Crypto API** before touching any storage. Your password derives a non-extractable `CryptoKey` via **PBKDF2** (310,000 iterations, SHA-256) — the server never holds your credentials or your keys. A separate verification hash (derived with a salt variant) is stored locally for login — not the key itself.

The server is structurally incapable of reading your content. Not by policy — by architecture.

> *"A platform where it's architecturally impossible for your most sensitive work to be accessed, leaked, or scraped by an LLM-training server without your explicit, encrypted consent."*

Full security documentation: [docs/SECURITY.md](docs/SECURITY.md)

## Roadmap

| Phase | Timeline | Focus | Status |
|-------|----------|-------|--------|
| Phase 1 — The Secure Bunker | Month 1 | Local E2EE vault, Web Crypto API, IndexedDB | ✅ Complete |
| Phase 2 — The Sync & Relay Layer | Month 2 | CRDT sync, blind relay server | 🔄 In progress |
| Phase 3 — The Public Bridge | Month 3 | Encrypted sharing, Transformers.js on-device AI | ⏳ Upcoming |

Full roadmap: [docs/ROADMAP.md](docs/ROADMAP.md)

## Documentation

- [Architecture](docs/ARCHITECTURE.md) — System design and crypto implementation
- [Security](docs/SECURITY.md) — Threat model and encryption details
- [Roadmap](docs/ROADMAP.md) — Build plan and milestones
- [Contributing](docs/CONTRIBUTING.md) — How to get involved

## Building in Public

Following the progress on [Bluesky](https://bsky.app/profile/clareifi.com) and [Threads](https://threads.net/@clareifi). No hype, no launch announcements — just honest build updates and architecture decisions as they happen.

---

*Built by [@clareifi](https://github.com/clareifi) · March 2026*
