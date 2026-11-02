<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { session } from '$lib/stores.svelte.js';
  import { vaultExists } from '$lib/storage.js';
  import { supabase } from '$lib/supabase.js';
  import '../app.css';
  import { inject } from '@vercel/analytics';
  inject();

  let { children } = $props();

  let theme = $state<'dark' | 'light'>('dark');

  // Routes that don't require an unlocked vault
  const PUBLIC_ROUTES = ['/setup', '/unlock'];

  // BroadcastChannel for cross-tab vault lock propagation.
  // SSR is disabled for this app so BroadcastChannel is always available.
  const vaultChannel = new BroadcastChannel('clareifi-vault');

  onMount(() => {
    const saved = localStorage.getItem('clareifi-theme');
    if (saved === 'light' || saved === 'dark') {
      theme = saved;
      document.documentElement.setAttribute('data-theme', saved);
    }
  });

  function toggleTheme() {
    theme = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('clareifi-theme', theme);
  }

  // Auth guard: re-evaluate whenever the session state or route changes.
  // If the vault is locked and we're not on a public route, redirect.
  $effect(() => {
    const currentPath = page.url.pathname;
    const isPublic =
      PUBLIC_ROUTES.includes(currentPath) ||
      currentPath.startsWith('/about') ||
      currentPath.startsWith('/u/') ||
      currentPath.startsWith('/s/');

    if (!session.isUnlocked && !isPublic) {
      vaultExists().then((exists) => {
        goto(exists ? '/unlock' : '/setup');
      });
    }
  });

  // Listen for lock events from other tabs. BroadcastChannel does not
  // deliver to the sender, so this only fires in non-originating tabs.
  $effect(() => {
    vaultChannel.onmessage = (event) => {
      if (event.data?.type === 'vault-locked') {
        session.clearSession();
        goto('/unlock');
      }
    };
    return () => {
      vaultChannel.onmessage = null;
      vaultChannel.close();
    };
  });

  async function lockVault() {
    session.clearSession();
    vaultChannel.postMessage({ type: 'vault-locked' });
    try {
      await supabase.auth.signOut({ scope: 'local' });
    } catch (e) {
      console.warn('signOut failed on vault lock', e);
      // proceed anyway — local state is already zeroed
    }
    goto('/unlock');
  }
</script>

<div class="min-h-screen flex flex-col bg-[var(--bg)] text-[var(--text)] transition-colors duration-150">
  {#if session.isUnlocked}
    <header class="sticky top-0 z-30 border-b border-neutral-800/80 bg-[var(--bg)]/90 backdrop-blur-md">
      <div class="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
        <div class="flex items-center gap-4">
          <a
            href="/"
            class="group flex items-center gap-2.5 text-sm font-medium tracking-tight text-[var(--text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 rounded-md px-1 py-0.5 transition duration-150"
          >
            <span class="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-xs font-mono">
              C
            </span>
            <span class="font-mono text-xs sm:text-sm tracking-tight">clareifi notes</span>
          </a>

          <span class="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 text-[11px] font-mono text-emerald-400">
            <span class="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            vault unlocked · {session.envelopeActive ? 'envelope v2' : 'aes-256-gcm'}
          </span>
        </div>

        <div class="flex items-center gap-2 sm:gap-3">
          <a
            href="/about"
            class="text-xs font-mono text-[var(--muted)] hover:text-[var(--text)] px-2 py-1 rounded-md transition duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-600"
          >
            architecture
          </a>

          <button
            type="button"
            onclick={toggleTheme}
            aria-label="Toggle color theme"
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            class="inline-flex items-center justify-center h-8 w-8 rounded-md border border-neutral-800 bg-[var(--surface)] text-[var(--muted)] hover:text-[var(--text)] hover:border-neutral-700 transition duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60"
          >
            {#if theme === 'dark'}
              <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="4"></circle>
                <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"></path>
              </svg>
            {:else}
              <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
              </svg>
            {/if}
          </button>

          <button
            type="button"
            onclick={lockVault}
            class="inline-flex items-center gap-1.5 rounded-md border border-neutral-800 bg-[var(--surface)] px-3 py-1.5 text-xs font-mono text-[var(--text-secondary)] hover:text-[var(--text)] hover:border-neutral-700 active:scale-[0.99] transition duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60"
          >
            <svg class="w-3.5 h-3.5 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
            </svg>
            <span>lock vault</span>
          </button>
        </div>
      </div>
    </header>
  {:else}
    <header class="border-b border-neutral-800/60 bg-[var(--bg)]/80 backdrop-blur-md">
      <div class="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
        <a
          href="/unlock"
          class="flex items-center gap-2.5 text-sm font-medium tracking-tight text-[var(--text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 rounded-md px-1 py-0.5"
        >
          <span class="flex h-6 w-6 items-center justify-center rounded-md bg-neutral-900 border border-neutral-800 text-neutral-300 text-xs font-mono">
            C
          </span>
          <span class="font-mono text-xs sm:text-sm tracking-tight">clareifi notes</span>
        </a>

        <div class="flex items-center gap-3">
          <a
            href="/about"
            class="text-xs font-mono text-[var(--muted)] hover:text-[var(--text)] px-2 py-1 rounded-md transition duration-150"
          >
            about
          </a>
          <button
            type="button"
            onclick={toggleTheme}
            aria-label="Toggle color theme"
            class="inline-flex items-center justify-center h-8 w-8 rounded-md border border-neutral-800 bg-[var(--surface)] text-[var(--muted)] hover:text-[var(--text)] hover:border-neutral-700 transition duration-150"
          >
            {#if theme === 'dark'}
              <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="4"></circle>
                <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"></path>
              </svg>
            {:else}
              <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
              </svg>
            {/if}
          </button>
        </div>
      </div>
    </header>
  {/if}

  <main class="flex-1 flex flex-col">
    {@render children()}
  </main>
</div>
