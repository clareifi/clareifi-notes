# Clareifi Notes — Development Roadmap

## Philosophy: Bottom-Up Approach

**Learning project** → **Portfolio piece** → **Monetizable SaaS**

---

## Phase 1: Learning Project (Months 1–3)
**Goal:** Ship something that works for personal daily use

### Week 1–2: Foundation
- [x] GitHub repository setup
- [x] Documentation structure (Obsidian dev journal + Standard Notes security docs)
- [ ] Weekend prototype: Encrypted textarea proof-of-concept
  - Password-derived key generation
  - Encrypt/decrypt single text field
  - Local storage only
- [ ] Choose final tech stack (confirm SvelteKit)
- [ ] Initial architecture documentation

### Week 3–6: Core Functionality
- [ ] Authentication system (email + password)
- [ ] Key derivation and management (Argon2id via libsodium)
- [ ] Note CRUD operations (create, read, update, delete)
- [ ] Client-side encryption/decryption
- [ ] IndexedDB for local-first storage
- [ ] Basic markdown editor integration (Tiptap or CodeMirror)

### Week 7–12: Polish for Personal Use
- [ ] Search (local, unencrypted index)
- [ ] Note organisation (folders/tags)
- [ ] Export functionality
- [ ] Basic UI/UX polish
- [ ] **Milestone: Daily personal use begins ✅**

### Phase 1 Consulting Deliverables
- [ ] Blog series: "Building E2EE Apps with AI Assistance" (4–6 posts)
- [ ] Technical documentation of all security decisions
- [ ] Case study: "What I Learned Implementing Zero-Knowledge Encryption"
- [ ] Open source the encryption wrapper library

---

## Phase 2: Portfolio Piece (Months 4–8)
**Goal:** Demonstrate expertise to potential consulting clients

### Month 4–5: Public Profile Feature
- [ ] User profile creation
- [ ] Public profile page (unencrypted, separate from vault)
- [ ] Custom subdomain/URL support
- [ ] Profile customisation (bio, links, theme)

### Month 6–7: Selective Sharing
- [ ] Encrypted share links for individual notes
- [ ] Permission management (view-only, expiring links)
- [ ] Share analytics (view counts)
- [ ] Embeddable public notes

### Month 7: Additional Content Types
- [ ] Code snippet support with syntax highlighting
- [ ] Article clipping (save from web)
- [ ] Basic file attachments

### Month 8: Security & Polish
- [ ] External security audit/review
- [ ] Penetration testing
- [ ] Performance optimisation
- [ ] Professional UI/UX design
- [ ] Mobile-responsive design

### Phase 2 Consulting Deliverables
- [ ] White paper: "Architecture Patterns for Privacy-First Applications"
- [ ] Workshop/webinar: "Building Trust Through Encryption"
- [ ] Client presentation deck with Clareifi Notes as case study
- [ ] Open source share link implementation
- [ ] Security audit report (public summary)

---

## Phase 3: Monetizable SaaS (Months 9–12)
**Goal:** Validate market fit and generate revenue

### Pricing Structure

| Tier | Price | Storage | Key Features |
|------|-------|---------|--------------|
| Free | $0 | 100 MB | Basic E2EE notes, public profile |
| Personal | $5–8/mo | 10 GB | All content types, unlimited shares, custom domain |
| Professional | $15–20/mo | 100 GB | API access, team sharing, priority support |
| Enterprise | Custom | Custom | Self-hosted, compliance docs, consulting included |

### Month 9: SaaS Infrastructure
- [ ] Stripe integration for subscriptions
- [ ] Tiered storage limits
- [ ] Usage analytics and monitoring
- [ ] Customer support system
- [ ] Terms of Service & Privacy Policy

### Month 10: Advanced Features
- [ ] Photo/media storage with encryption
- [ ] RSS feed reader integration
- [ ] Advanced search (encrypted indexes)
- [ ] Team/collaboration features (shared vaults)
- [ ] API access for Professional tier

### Month 11: Scale & Performance
- [ ] CDN setup for global performance
- [ ] Database optimisation
- [ ] Automated backups
- [ ] Incident response procedures
- [ ] GDPR/compliance documentation

### Month 12: Launch Preparation
- [ ] Beta programme (100 users)
- [ ] Marketing website
- [ ] Documentation and tutorials
- [ ] Email onboarding sequence
- [ ] **Public launch 🚀**

---

## Success Metrics

| Phase | Key Metrics |
|-------|------------|
| Phase 1 | Daily personal use for 30+ days · 3+ blog posts · security architecture documented |
| Phase 2 | External security review complete · 50+ GitHub stars · 2+ consulting leads |
| Phase 3 | 100+ beta users · $1,000+ MRR · 5+ enterprise inquiries · 99%+ uptime |

---

## Future Considerations (Post-Launch)

- Mobile apps (iOS/Android)
- Desktop apps (Electron)
- Browser extensions for article clipping
- CLI tool
- Obsidian import/export
- Standard Notes migration tool
- AI-powered features (summarisation, smart search)

---

**Last Updated:** March 2025
**Current Phase:** Phase 1 — Week 1
