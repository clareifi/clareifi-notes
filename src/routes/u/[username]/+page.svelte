<!-- Phase 3 Scaffolding: Public Profile (/u/[username]) -->
<script lang="ts">
  import { page } from '$app/state';
  import type { PublicProfile } from '$lib/types.js';

  let username = $derived(page.params.username ?? 'anonymous');

  let profile = $derived<PublicProfile>({
    username,
    displayName: `@${username}`,
    bio: 'Zero-knowledge notes & cryptographically verified public dispatches on Clareifi.',
    keyFingerprint: 'SHA256:9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
    publishedNoteCount: 0,
    createdAt: '2026-04-01T00:00:00.000Z',
  });
</script>

<svelte:head>
  <title>@{profile.username} — Clareifi Public Profile</title>
</svelte:head>

<div class="max-w-3xl w-full mx-auto px-4 sm:px-6 py-10 sm:py-16">
  <div class="rounded-2xl border border-neutral-800 bg-[var(--surface)] p-6 sm:p-8 shadow-xl">
    <div class="flex flex-wrap items-start justify-between gap-4 pb-6 border-b border-neutral-800/80">
      <div class="flex items-center gap-4">
        <div class="flex h-12 w-12 items-center justify-center rounded-xl border border-emerald-500/25 bg-emerald-500/10 text-emerald-400 font-mono text-lg font-semibold">
          {profile.username.slice(0, 1).toUpperCase()}
        </div>
        <div>
          <div class="flex items-center gap-2">
            <h1 class="text-lg sm:text-xl font-semibold text-[var(--text)]">
              {profile.displayName}
            </h1>
            <span class="rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[10px] font-mono text-emerald-400">
              Phase 3 Preview
            </span>
          </div>
          <p class="text-xs sm:text-sm text-[var(--text-secondary)] mt-1">
            {profile.bio}
          </p>
        </div>
      </div>

      <a
        href="/"
        class="rounded-lg border border-neutral-800 bg-[var(--bg)] px-3 py-1.5 text-xs font-mono text-[var(--muted)] hover:text-[var(--text)] transition duration-150"
      >
        ← back to vault
      </a>
    </div>

    <!-- Cryptographic Identity Fingerprint -->
    <div class="mt-6 rounded-xl border border-neutral-800/80 bg-[var(--bg)] p-4">
      <div class="flex items-center justify-between text-xs font-mono text-[var(--muted)] mb-1.5">
        <span>Public Identity Key Fingerprint</span>
        <span class="text-emerald-400">Ed25519 / Web Crypto</span>
      </div>
      <code class="block text-xs font-mono text-[var(--text-secondary)] break-all">
        {profile.keyFingerprint}
      </code>
    </div>

    <!-- Published Notes Stub -->
    <div class="mt-8 text-center py-10 rounded-xl border border-dashed border-neutral-800">
      <p class="text-xs font-mono text-emerald-400 uppercase tracking-wider mb-1">
        Public Dispatches · 0 published
      </p>
      <p class="text-xs sm:text-sm text-[var(--text-secondary)] max-w-md mx-auto">
        @{profile.username} has not published any public notes yet. Private vault notes remain end-to-end encrypted and invisible to public profiles.
      </p>
    </div>
  </div>
</div>
