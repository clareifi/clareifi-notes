# Clareifi Notes

**Privacy-first knowledge management for the AI age**

> A learning project turned portfolio piece turned product — built in public to demonstrate practical implementation of end-to-end encryption in modern web applications.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](docs/CONTRIBUTING.md)
[![Built in Public](https://img.shields.io/badge/Built%20in-Public-blue)](https://bsky.app/profile/clareifi.com)

## What is Clareifi Notes?

Clareifi Notes is an end-to-end encrypted knowledge management platform that combines the local-first philosophy of Obsidian with the flexibility of modern web applications. Store notes, code, articles, and media with zero-knowledge encryption while maintaining a public profile for selective sharing.

**Core Principles:**
- 🔐 **Privacy by default** — End-to-end encryption for your personal vault
- 🌐 **Selectively public** — Share what you want via encrypted links
- 📱 **Local-first** — Works offline, syncs when you want
- 🎯 **Built with AI** — Developed using AI-assisted tools to demonstrate modern development workflows

## Why This Exists

This project serves three purposes:

1. **Learning Project** — Master E2EE implementation with AI-assisted development
2. **Portfolio Piece** — Demonstrate secure architecture patterns for consulting clients
3. **Product Vision** — Build a privacy-first alternative to existing knowledge management tools

Part of [The Clareifi Collective](https://clareifi.com) — AI ethics and policy consulting.

## Current Status: Phase 1 (Learning)

🚧 **In active development** — Follow along as I build in public

**Phase 1 Goals (Months 1–3):**
- ✅ Repository setup and architecture planning
- ⬜ Weekend prototype: encrypted textarea with password-derived keys
- ⬜ Basic note creation/editing with client-side encryption
- ⬜ Local storage with IndexedDB
- ⬜ Authentication flow
- ⬜ Daily personal use achieved

See [docs/ROADMAP.md](docs/ROADMAP.md) for the complete three-phase plan.

## Features (Planned)

### Phase 1 — Core Encryption
- End-to-end encrypted notes
- Password-derived key management
- Local-first storage
- Basic markdown editor

### Phase 2 — Sharing & Content Types
- Public profile pages
- Encrypted link-based sharing
- Code snippets and clipped articles
- Cross-device sync

### Phase 3 — Production SaaS
- Photo/media storage
- RSS feed aggregation
- Team collaboration
- Mobile apps
- Self-hosted option

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | SvelteKit |
| Encryption | libsodium.js |
| Backend / Auth | Supabase |
| Deployment | Vercel |
| Sync (Phase 2) | Automerge / Yjs |
| Editor | Tiptap / CodeMirror |

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for detailed technical decisions.

## Security

Security is the foundation of this project. Every security decision is documented and an external audit is planned before any production launch.

- **Threat model:** [docs/SECURITY.md](docs/SECURITY.md)
- **Security issues:** Report responsibly via security@clareifi.com
- **Crypto policy:** Industry-standard libsodium.js — no roll-your-own crypto

## Building in Public

Follow the development journey:
- 🦋 [Bluesky](https://bsky.app/profile/clareifi.com)
- 🧵 [Threads](https://threads.net/@clareifi)
- 🐦 [X / Twitter](https://x.com/clareifi)
- 📝 [Blog](https://clareifi.com)

Weekly dev logs published every Friday.

## Contributing

This is primarily a learning project during Phase 1, but contributions are welcome:
- 🐛 Bug reports
- 💡 Feature suggestions
- 🔒 Security feedback
- 📖 Documentation improvements

See [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) for guidelines.

## About the Builder

I'm Euri, founder of [Clareifi AI](https://clareifi.com) — AI ethics and policy consulting for law firms and SMBs. This project demonstrates the practical implementation challenges I help clients navigate.

- 🌐 [clareifi.com](https://clareifi.com)
- 🦋 [@clareifi.com](https://bsky.app/profile/clareifi.com) on Bluesky

## License

MIT © 2025 Clareifi — See [LICENSE](LICENSE) for details.

---

*"Build things worth keeping. Document things worth remembering. Leave things better than you found them."*
