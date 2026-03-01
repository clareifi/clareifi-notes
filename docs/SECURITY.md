# Security Policy

## ⚠️ Current Status: Phase 1 — Learning Project

This is an active learning project and is **not yet suitable for sensitive or production data**. Security features are being implemented incrementally. See the roadmap for planned security milestones.

**Do not use for:**
- Production or business-critical data
- Highly sensitive personal information
- Any data where loss would be unacceptable (no password recovery yet)

---

## Reporting a Vulnerability

**Please do not open public GitHub issues for security vulnerabilities.**

Email: **security@clareifi.com**

Include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact assessment
- Suggested fix (if any)

Response commitment: **48 hours** for acknowledgement, **7 days** for initial assessment.

---

## Security Principles

| Principle | Implementation |
|-----------|---------------|
| Zero-knowledge architecture | Server stores only encrypted blobs it cannot read |
| Client-side encryption only | All crypto operations happen in the browser |
| No custom cryptography | Industry-standard libsodium.js exclusively |
| Transparency | All security decisions documented publicly |
| External audits | Review planned before any production launch |

---

## Cryptographic Details

### Algorithms in Use
| Operation | Algorithm | Library |
|-----------|-----------|---------|
| Symmetric encryption | XSalsa20-Poly1305 | libsodium.js |
| Key derivation | Argon2id | libsodium.js |
| Random generation | CSPRNG via `randombytes_buf` | libsodium.js |

### Why libsodium?
- Formally audited by multiple security firms
- Designed to be misuse-resistant
- WebAssembly build provides near-native performance
- Widely used in production E2EE systems

### Key Management
- Master key is derived from the user's password using Argon2id
- Master key exists **in memory only** during an active session
- Master key is **never transmitted** to any server
- Each note is encrypted with a unique nonce (never reused)
- Share link keys are cryptographically independent from the master key

---

## Known Limitations (Phase 1)

| Limitation | Status | Planned Resolution |
|------------|--------|-------------------|
| No password recovery | Known | Key backup with recovery phrase (Phase 2) |
| No security audit | Pending | External audit before Phase 3 launch |
| No penetration testing | Pending | Phase 2 |
| No rate limiting | Pending | Phase 2 |
| No breach detection | Pending | Phase 3 |
| No formal incident response | Pending | Phase 3 |

---

## Security Roadmap

### Phase 1 (Current)
- [x] Client-side encryption with libsodium.js
- [x] Argon2id key derivation
- [x] Security architecture documentation
- [ ] Content Security Policy (CSP) headers
- [ ] Subresource Integrity (SRI) for all CDN assets
- [ ] Automated dependency vulnerability scanning (Dependabot)
- [ ] Password strength enforcement (zxcvbn)

### Phase 2
- [ ] External security audit
- [ ] Penetration testing
- [ ] Key rotation / password change without full re-encryption
- [ ] Account recovery options (recovery phrase)
- [ ] Rate limiting on auth endpoints
- [ ] Breach detection alerts

### Phase 3 (Pre-launch)
- [ ] Bug bounty programme
- [ ] SOC 2 Type II assessment (if enterprise demand warrants)
- [ ] Regular scheduled security audits
- [ ] Formal incident response plan
- [ ] Security training documentation

---

## Dependencies

The security posture of Clareifi Notes relies on the security of:

| Dependency | Role | Security Page |
|------------|------|--------------|
| libsodium.js | Client-side cryptography | [libsodium docs](https://doc.libsodium.org) |
| Supabase | Auth, database, storage | [Supabase security](https://supabase.com/security) |
| Vercel | Hosting and edge delivery | [Vercel security](https://vercel.com/security) |
| SvelteKit | Frontend framework | [SvelteKit security](https://kit.svelte.dev/docs/security) |

Dependencies are monitored via GitHub Dependabot and updated regularly.

---

## Responsible Disclosure

If you discover a security issue, please follow responsible disclosure:

1. Email security@clareifi.com with full details
2. Allow reasonable time for a fix before public disclosure
3. Do not exploit the vulnerability beyond proof-of-concept
4. Do not access or modify other users' data

We will acknowledge your contribution publicly (with your permission) once the issue is resolved.

---

*Security is not a feature — it is the foundation. Every architectural decision in this project is made with the question: "What happens when this is compromised?"*
