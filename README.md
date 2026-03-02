# Clareifi Notes

**Privacy-first knowledge management for the AI age**

> A learning project turned portfolio piece turned product — built in public to demonstrate practical implementation of end-to-end encryption in modern web applications.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](docs/CONTRIBUTING.md)
[![Built in Public](https://img.shields.io/badge/Built%20in%20Public-blue)](https://bsky.app/profile/clareifi.com)

## What is Clareifi Notes?

Clareifi Notes is an end-to-end encrypted knowledge management platform that combines the local-first philosophy of Obsidian with the flexibility of modern web applications. Store notes, code, articles, and media with zero-knowledge encryption while maintaining a public profile for selective sharing.

**Core Principles:**
- 🔐 **Privacy by default** — End-to-end encryption for your personal vault
- 🏠 **Local-first** — Your data lives on your device, syncs on your terms
- 🕶️ **Zero-knowledge** — The server holds encrypted blobs it cannot open
- 🤖 **On-device AI** — Search and summarise locally; nothing leaves your machine
- ✊ **Your consent, your rules** — Selective sharing via ephemeral encrypted links

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Frontend | SvelteKit + TypeScript | Reactive UI, type-safe throughout |
| Encryption | Web Crypto API (AES-GCM) | Native browser crypto, zero dependencies |
| Local Storage | IndexedDB (idb-keyval) | High-performance local-first storage |
| Sync | Yjs / Automerge (CRDT) | Conflict-free multi-device sync |
| Backend | Supabase | Blind relay — stores encrypted blobs only |
| Deployment | Vercel | Edge-optimised hosting |
| On-device AI | Transformers.js | Local LLM for search/summarise |

## Security Architecture

Notes are encrypted on your device using **AES-GCM** via the native **Web Crypto API** before leaving your machine. Your password derives a local key via a key-derivation function — the server never holds your credentials or your keys.

The server is structurally incapable of reading your content. Not by policy — by architecture.

> *"A platform where it's architecturally impossible for your most sensitive work to be accessed, leaked, or scraped by an LLM-training server without your explicit, encrypted consent."*

Full security documentation: [docs/SECURITY.md](docs/SECURITY.md)

## Project Status

| Phase | Focus | Status |
|-------|-------|--------|
| Phase 1 (Months 1–3) | Foundation — local encryption, key-derived auth, IndexedDB vault | 🟢 In progress |
| Phase 2 (Months 4–8) | Sync layer, open source portfolio, working product | ⬜ Upcoming |
| Phase 3 (Months 9–12) | SaaS launch, encrypted sharing, sustainable indie business | ⬜ Upcoming |

See the full roadmap: [docs/ROADMAP.md](docs/ROADMAP.md)

## Building in Public

Follow the build as it happens:

- 🦋 Bluesky: [@clareifi.com](https://bsky.app/profile/clareifi.com)
- 🧵 Threads: [@clareifi.com](https://www.threads.net/@clareifi.com)
- 🐦 X: [@clareifi](https://x.com/clareifi)
- 🌐 Blog: [clareifi.com](https://www.clareifi.com)

## About the Builder

Built by [Euri](https://github.com/clareifi) — working at the intersection of privacy, knowledge management, and independent software development.

*Building things worth keeping. Documenting things worth remembering. Leaving things better than I found them.*

## Contributing

See [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md). Security issues: security@clareifi.com

## License

MIT — see [LICENSE](LICENSE)
