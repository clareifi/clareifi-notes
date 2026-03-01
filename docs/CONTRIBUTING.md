# Contributing to Clareifi Notes

Thank you for your interest in contributing! This is primarily a **learning project** during Phase 1, but thoughtful contributions are very welcome.

---

## Ways to Contribute

### Right Now (Phase 1)
- 🐛 **Bug reports** — Found something broken? Open an issue
- 💡 **Feature suggestions** — Ideas for the roadmap? Start a discussion
- 🔒 **Security feedback** — See [SECURITY.md](SECURITY.md) for responsible disclosure
- 📖 **Documentation** — Typos, clarity improvements, missing explanations
- 🧠 **Architecture input** — Thoughts on the technical decisions in ARCHITECTURE.md

### Phase 2 and Beyond
- Code contributions (once the core architecture is stable)
- UI/UX design input
- Translations / internationalisation
- Security audit participation

---

## Before You Start

1. **Check existing issues** — Your idea may already be tracked
2. **Open an issue first** for any significant change — align before investing time
3. **Read the architecture docs** — Understand the security model before touching crypto-related code
4. **Security changes require extra scrutiny** — Any change touching encryption, key management, or the public/private boundary needs detailed justification

---

## Development Setup

> ⚠️ Full setup guide coming in Phase 1 Week 3 once the tech stack is finalised.

```bash
# Clone the repo
git clone https://github.com/clareifi/clareifi-notes.git
cd clareifi-notes

# Install dependencies (SvelteKit)
npm install

# Copy environment variables
cp .env.example .env
# Fill in your Supabase credentials

# Start development server
npm run dev
```

---

## Code Standards

### General
- Write clear, readable code over clever code
- Comment *why*, not *what*
- Every function that touches encryption must have a comment explaining the security rationale

### Security Rules (Non-Negotiable)
- **Never** send unencrypted user content to the server
- **Never** store the master key anywhere persistent (memory only)
- **Never** reuse nonces
- **Never** implement custom cryptographic algorithms — use libsodium.js primitives
- Any deviation from these rules requires explicit discussion and approval

### Commit Messages
Follow conventional commits:
```
feat: add encrypted note export
fix: correct nonce generation for file attachments
docs: update architecture decision for sync strategy
security: strengthen password requirements to 12 chars minimum
```

---

## Pull Request Process

1. Fork the repo and create a branch: `git checkout -b feat/your-feature`
2. Make your changes with clear, focused commits
3. Update relevant documentation (especially ARCHITECTURE.md for technical decisions)
4. Open a PR with a clear description of *what* and *why*
5. Link to any related issues
6. PRs touching security-sensitive code will require additional review time

---

## Issue Templates

Use the appropriate template when opening issues:
- **Bug report** — Something is broken
- **Feature request** — Something new to add
- **Security issue** — See [SECURITY.md](SECURITY.md) instead — do not use public issues

---

## Code of Conduct

This project follows a simple standard: be kind, be constructive, be patient. This is a learning project built in public — mistakes will happen and that's the point. Feedback should help the project improve, not make contributors feel bad for trying.

---

## Questions?

- Open a [Discussion](https://github.com/clareifi/clareifi-notes/discussions) for general questions
- Follow the build-in-public journey on [Bluesky](https://bsky.app/profile/clareifi.com) for real-time updates
- Email hello@clareifi.com for anything else

---

*Built in public by [@clareifi](https://clareifi.com) — learning E2EE one commit at a time.*
