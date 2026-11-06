<script lang="ts">
  interface Phase {
    name: string;
    status: 'complete' | 'in-progress';
    milestone: string;
    description: string;
  }

  interface NextFeature {
    title: string;
    description: string;
  }

  interface TechnicalHighlight {
    label: string;
    detail: string;
  }

  interface SocialLink {
    label: string;
    handle: string;
    href: string;
  }

  const technicalHighlights: TechnicalHighlight[] = [
    {
      label: 'Encryption',
      detail: 'AES-GCM 256-bit with unique 12-byte IV per note title and content.'
    },
    {
      label: 'Key Derivation & Separation',
      detail: 'Master Key Encryption Key (KEK) derived via PBKDF2-HMAC-SHA-256 (310,000 iterations) with a unique vault salt.'
    },
    {
      label: 'Envelope Encryption',
      detail: 'Dedicated Data Encryption Key (DEK) wrapped by KEK, allowing password changes and key rotation without mass re-encryption.'
    },
    {
      label: 'Key Handling',
      detail: 'Non-extractable Web Crypto API handles; memory zeroed out across tabs on lock.'
    },
    {
      label: 'Dual-Layer Persistence',
      detail: 'IndexedDB (idb-keyval) local source of truth + Supabase PostgreSQL ciphertext sync with Row Level Security (RLS).'
    }
  ];

  const phases: Phase[] = [
    {
      name: 'Phase 1 — Local-First E2EE',
      status: 'complete',
      milestone: 'Shipped March 2026',
      description:
        'AES-256-GCM encryption, PBKDF2 derivation, vault lock/unlock lifecycle, encrypted titles, and IndexedDB storage.'
    },
    {
      name: 'Phase 2 — Multi-Device Sync & Auth',
      status: 'complete',
      milestone: 'Shipped April 2026',
      description:
        'Supabase Auth, encrypted cloud sync, RLS data isolation, remote reconciliation, and cross-browser salt derivation.'
    },
    {
      name: 'Phase 3 (Architecture) — Envelope Encryption & UI Overhaul',
      status: 'complete',
      milestone: 'Shipped 2026',
      description:
        'DEK/KEK envelope key hierarchy, background ciphertext migration, multi-tab lock broadcasting, distraction-free editor with in-memory search, and immutable creation timestamps.'
    }
  ];

  const phase4Features: NextFeature[] = [
    {
      title: 'Selective Sharing',
      description:
        'Zero-knowledge single-note sharing via encrypted URL fragments (/s/[id]#key=...) where the secret key never touches the backend.'
    },
    {
      title: 'Public Profiles',
      description:
        'Lightweight creator profiles (/u/[username]) for non-sensitive public metadata.'
    },
    {
      title: 'External Security Audit',
      description:
        'Third-party cryptographic audit and penetration testing before general public availability.'
    },
    {
      title: 'Mobile Enhancements',
      description:
        'Progressive Web App (PWA) offline packaging and dedicated native shells.'
    }
  ];

  const techStack: string[] = [
    'SvelteKit 2 + Svelte 5 (Runes)',
    'TypeScript 5',
    'Tailwind CSS 4',
    'IndexedDB (idb-keyval) + Supabase PostgreSQL',
    'Web Crypto API (SubtleCrypto)',
    'Vercel Hosting'
  ];

  const socialLinks: SocialLink[] = [
    {
      label: 'GitHub',
      handle: 'clareifi/clareifi-notes',
      href: 'https://github.com/clareifi/clareifi-notes'
    },
    {
      label: 'X (Twitter)',
      handle: '@clareifi',
      href: 'https://x.com/clareifi'
    },
    {
      label: 'Bluesky',
      handle: '@clareifi.com',
      href: 'https://bsky.app/profile/clareifi.com'
    },
    {
      label: 'Threads',
      handle: '@clareifi',
      href: 'https://threads.net/@clareifi'
    }
  ];
</script>

<svelte:head>
  <title>About — Clareifi Notes</title>
  <meta
    name="description"
    content="Clareifi Notes: Privacy by architecture, not policy. End-to-end encrypted notes with zero-knowledge envelope key architecture."
  />
</svelte:head>

<div class="min-h-full bg-neutral-950 text-neutral-100 font-mono">
  <div class="max-w-2xl mx-auto px-5 sm:px-6 py-12 sm:py-16 space-y-12">
    <!-- 1. Header & Core Ethos -->
    <header class="pb-8 border-b border-neutral-800">
      <div class="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-[11px] text-emerald-400 mb-4">
        <span class="h-1.5 w-1.5 rounded-full bg-emerald-400"></span>
        <span>Zero-Knowledge E2EE Architecture</span>
      </div>
      <h1 class="text-2xl sm:text-3xl font-semibold tracking-tight text-neutral-100">
        Clareifi Notes
      </h1>
      <p class="mt-2 text-sm text-neutral-400 italic">
        "Privacy by architecture, not policy."
      </p>
    </header>

    <!-- 2. What I'm Building -->
    <section aria-labelledby="section-mission" class="space-y-3">
      <h2
        id="section-mission"
        class="text-xs font-semibold uppercase tracking-widest text-neutral-400"
      >
        What I'm Building
      </h2>
      <div class="space-y-3 text-sm text-neutral-300 leading-relaxed font-sans">
        <p>
          Clareifi Notes is an end-to-end encrypted notes application built on a strict zero-knowledge model. Every note title and body is encrypted client-side in your browser before it ever leaves your device.
        </p>
        <p>
          The server acts purely as a ciphertext store with zero access to your plaintext, passwords, or raw cryptographic keys. Privacy is enforced by mathematical guarantees rather than terms-of-service promises.
        </p>
      </div>
    </section>

    <!-- 3. How It Works (Technical Highlights) -->
    <section aria-labelledby="section-security" class="space-y-4">
      <h2
        id="section-security"
        class="text-xs font-semibold uppercase tracking-widest text-neutral-400"
      >
        How It Works
      </h2>
      <ul class="divide-y divide-neutral-800 rounded-xl border border-neutral-800 bg-neutral-900/40">
        {#each technicalHighlights as item (item.label)}
          <li class="px-4 py-3.5 text-xs sm:text-sm leading-relaxed">
            <span class="font-semibold text-emerald-400">{item.label}:</span>
            <span class="text-neutral-300 font-sans ml-1">{item.detail}</span>
          </li>
        {/each}
      </ul>
    </section>

    <!-- 4. Build Progress (Phases) -->
    <section aria-labelledby="section-progress" class="space-y-4">
      <h2
        id="section-progress"
        class="text-xs font-semibold uppercase tracking-widest text-neutral-400"
      >
        Build Progress
      </h2>
      <div class="space-y-3">
        {#each phases as phase (phase.name)}
          <div class="rounded-xl border border-emerald-900/50 bg-neutral-900/50 p-4 space-y-2">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <div class="flex items-center gap-2">
                <span class="text-emerald-400 text-sm font-bold" aria-hidden="true">✓</span>
                <h3 class="text-xs sm:text-sm font-semibold text-neutral-100">
                  {phase.name}
                </h3>
              </div>
              <span class="text-[11px] text-emerald-400/90 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-2.5 py-0.5">
                {phase.milestone}
              </span>
            </div>
            <p class="text-xs sm:text-sm text-neutral-400 leading-relaxed pl-5 font-sans">
              {phase.description}
            </p>
          </div>
        {/each}
      </div>
    </section>

    <!-- 5. What's Next (Phase 4) -->
    <section aria-labelledby="section-next" class="space-y-4">
      <h2
        id="section-next"
        class="text-xs font-semibold uppercase tracking-widest text-neutral-400"
      >
        What's Next
      </h2>
      <div class="rounded-xl border border-amber-500/30 bg-neutral-900/40 p-5 space-y-4">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div class="flex items-center gap-2">
            <span class="text-amber-400 text-sm font-bold" aria-hidden="true">→</span>
            <h3 class="text-xs sm:text-sm font-semibold text-neutral-100">
              Phase 4 — Production Sharing &amp; Hardening
            </h3>
          </div>
          <span class="text-[11px] text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-full px-2.5 py-0.5">
            Upcoming Roadmap
          </span>
        </div>

        <ul class="space-y-3 pl-5">
          {#each phase4Features as feature (feature.title)}
            <li class="text-xs sm:text-sm leading-relaxed">
              <span class="font-semibold text-neutral-200">{feature.title}:</span>
              <span class="text-neutral-400 font-sans ml-1">{feature.description}</span>
            </li>
          {/each}
        </ul>
      </div>
    </section>

    <!-- 6. Tech Stack -->
    <section aria-labelledby="section-stack" class="space-y-4">
      <h2
        id="section-stack"
        class="text-xs font-semibold uppercase tracking-widest text-neutral-400"
      >
        Tech Stack
      </h2>
      <div class="flex flex-wrap gap-2">
        {#each techStack as tech (tech)}
          <span class="rounded-lg border border-neutral-800 bg-neutral-900/60 px-3 py-1.5 text-xs text-neutral-300">
            {tech}
          </span>
        {/each}
      </div>
    </section>

    <!-- 7. Follow Along / Ecosystem Links -->
    <section aria-labelledby="section-links" class="space-y-4">
      <h2
        id="section-links"
        class="text-xs font-semibold uppercase tracking-widest text-neutral-400"
      >
        Follow Along
      </h2>
      <p class="text-xs sm:text-sm text-neutral-400 font-sans">
        Clareifi Notes is built in public. Explore the source code or follow updates across the ecosystem:
      </p>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {#each socialLinks as link (link.label)}
          <a
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            class="group flex items-center justify-between rounded-lg border border-neutral-800 bg-neutral-900/40 px-3.5 py-2.5 text-xs transition duration-150 hover:border-neutral-700 hover:bg-neutral-900"
          >
            <span class="text-neutral-400 group-hover:text-neutral-200 transition duration-150">
              {link.label}
            </span>
            <span class="text-neutral-200 group-hover:text-emerald-400 transition duration-150">
              {link.handle} ↗
            </span>
          </a>
        {/each}
      </div>

      <div class="pt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-400">
        <span class="text-neutral-500">Web:</span>
        <a
          href="https://clareifi.com"
          target="_blank"
          rel="noopener noreferrer"
          class="text-neutral-300 hover:text-emerald-400 underline underline-offset-4 decoration-neutral-700 hover:decoration-emerald-400 transition duration-150"
        >
          clareifi.com
        </a>
        <span class="text-neutral-700">·</span>
        <a
          href="https://clareifi.xyz"
          target="_blank"
          rel="noopener noreferrer"
          class="text-neutral-300 hover:text-emerald-400 underline underline-offset-4 decoration-neutral-700 hover:decoration-emerald-400 transition duration-150"
        >
          clareifi.xyz
        </a>
      </div>
    </section>

    <!-- Footer -->
    <footer class="pt-8 border-t border-neutral-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-neutral-500">
      <p>MIT © 2026 Clareifi</p>
      <a
        href="/"
        class="text-neutral-400 hover:text-emerald-400 transition duration-150"
      >
        ← Back to Vault
      </a>
    </footer>
  </div>
</div>
