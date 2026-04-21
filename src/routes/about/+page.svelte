<script>
  const phases = [
    {
      name: 'Phase 1 — Local-first E2EE',
      status: 'complete',
      description: 'AES-256-GCM encryption, PBKDF2 key derivation, vault lock/unlock, IndexedDB storage.',
      milestone: 'March 2026'
    },
    {
      name: 'Phase 2 — Supabase Sync + Auth',
      status: 'complete',
      description: 'Email/password auth, encrypted cloud sync, Row Level Security, multi-device support.',
      milestone: 'April 2026'
    },
    {
      name: 'Phase 3 — Production SaaS',
      status: 'in-progress',
      description: 'Envelope key architecture, public profiles, selective sharing, security audit, Stripe billing.',
      milestone: 'Q3 2026'
    }
  ];
</script>

<svelte:head>
  <title>About — Clareifi Notes</title>
  <meta name="description" content="Clareifi Notes: Privacy by architecture, not policy. End-to-end encrypted notes with zero-knowledge design." />
</svelte:head>

<div class="about">
  <header class="hero">
    <h1>clareifi notes</h1>
    <p class="tagline">privacy by architecture, not policy.</p>
  </header>

  <section class="mission">
    <h2>What I'm building</h2>
    <p>
      Clareifi Notes is an end-to-end encrypted notes app built on zero-knowledge architecture.
      Your notes are encrypted before they leave your device — I never see your content, your keys,
      or your plaintext. The server only stores ciphertext.
    </p>
    <p>
      I believe privacy should be a structural guarantee, not a policy promise.
    </p>
  </section>

  <section class="security">
    <h2>How it works</h2>
    <ul>
      <li><span class="label">Encryption:</span> AES-GCM 256-bit with unique IV per note</li>
      <li><span class="label">Key derivation:</span> PBKDF2 with 310,000 iterations + random salt</li>
      <li><span class="label">Key handling:</span> Non-extractable CryptoKey via Web Crypto API</li>
      <li><span class="label">Storage:</span> IndexedDB (local) + Supabase (encrypted sync)</li>
      <li><span class="label">Access control:</span> Row Level Security — users can only access their own data</li>
    </ul>
  </section>

  <section class="roadmap">
    <h2>Build progress</h2>
    <div class="phases">
      {#each phases as phase}
        <div class="phase" class:complete={phase.status === 'complete'} class:in-progress={phase.status === 'in-progress'}>
          <div class="phase-header">
            <span class="phase-status">
              {#if phase.status === 'complete'}✓{:else}→{/if}
            </span>
            <h3>{phase.name}</h3>
          </div>
          <p class="phase-description">{phase.description}</p>
          <span class="phase-milestone">{phase.milestone}</span>
        </div>
      {/each}
    </div>
  </section>

  <section class="stack">
    <h2>Tech stack</h2>
    <div class="stack-grid">
      <span>SvelteKit 2</span>
      <span>Svelte 5</span>
      <span>TypeScript</span>
      <span>Tailwind CSS 4</span>
      <span>Supabase</span>
      <span>Vercel</span>
      <span>Web Crypto API</span>
      <span>IndexedDB</span>
    </div>
  </section>

  <section class="connect">
    <h2>Follow along</h2>
    <p>Clareifi Notes is built in public. Follow the journey:</p>
    <div class="links">
      <a href="https://github.com/clareifi/clareifi-notes" target="_blank" rel="noopener">GitHub</a>
      <a href="https://bsky.app/profile/clareifi.com" target="_blank" rel="noopener">Bluesky</a>
    </div>
  </section>

  <footer class="about-footer">
    <p>© {new Date().getFullYear()} Clareifi. MIT License.</p>
  </footer>
</div>

<style>
  .about {
    max-width: 640px;
    margin: 0 auto;
    padding: 3rem 1.5rem;
    font-family: var(--font-mono);
    color: var(--text);
  }

  .hero {
    text-align: center;
    margin-bottom: 3rem;
    padding-bottom: 2rem;
    border-bottom: 1px solid var(--border);
  }

  .hero h1 {
    font-size: 1.75rem;
    font-weight: 600;
    letter-spacing: -0.02em;
    margin: 0 0 0.5rem;
  }

  .tagline {
    color: var(--muted);
    font-size: 0.9rem;
    font-style: italic;
  }

  section {
    margin-bottom: 2.5rem;
  }

  h2 {
    font-size: 1rem;
    font-weight: 600;
    text-transform: lowercase;
    color: var(--muted);
    margin: 0 0 1rem;
    letter-spacing: 0.05em;
  }

  p {
    line-height: 1.7;
    font-size: 0.875rem;
    margin: 0 0 0.75rem;
  }

  .security ul {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  .security li {
    font-size: 0.825rem;
    padding: 0.5rem 0;
    border-bottom: 1px solid var(--border);
    line-height: 1.5;
  }

  .security li:last-child {
    border-bottom: none;
  }

  .label {
    color: var(--muted);
  }

  .phases {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .phase {
    padding: 1rem;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--surface);
  }

  .phase.complete {
    border-color: #2d4a2d;
  }

  .phase.in-progress {
    border-color: #4a4a2d;
  }

  .phase-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
  }

  .phase-status {
    font-size: 0.875rem;
    width: 1.25rem;
    flex-shrink: 0;
  }

  .complete .phase-status {
    color: #4ade80;
  }

  .in-progress .phase-status {
    color: #facc15;
  }

  h3 {
    font-size: 0.875rem;
    font-weight: 600;
    margin: 0;
  }

  .phase-description {
    font-size: 0.8rem;
    color: var(--muted);
    margin: 0 0 0.5rem;
    padding-left: 1.75rem;
  }

  .phase-milestone {
    font-size: 0.75rem;
    color: var(--muted);
    padding-left: 1.75rem;
  }

  .stack-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .stack-grid span {
    font-size: 0.75rem;
    padding: 0.35rem 0.75rem;
    border: 1px solid var(--border);
    border-radius: 4px;
    background: var(--surface);
    color: var(--muted);
  }

  .connect .links {
    display: flex;
    gap: 1.5rem;
    margin-top: 0.75rem;
  }

  .connect a {
    font-size: 0.825rem;
    color: var(--text);
    text-decoration: none;
    border-bottom: 1px solid var(--border);
    padding-bottom: 2px;
    transition: border-color 0.2s;
  }

  .connect a:hover {
    border-color: var(--text);
  }

  .about-footer {
    margin-top: 3rem;
    padding-top: 1.5rem;
    border-top: 1px solid var(--border);
    text-align: center;
  }

  .about-footer p {
    font-size: 0.75rem;
    color: var(--muted);
  }
</style>
