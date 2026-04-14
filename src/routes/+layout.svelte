<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { session } from '$lib/stores.svelte.js';
  import { vaultExists } from '$lib/storage.js';
  import { supabase } from '$lib/supabase.js';
  import '../app.css';
  import { inject } from '@vercel/analytics';
  inject();

  let { children } = $props();

  // Routes that don't require an unlocked vault
  const PUBLIC_ROUTES = ['/setup', '/unlock'];

  // BroadcastChannel for cross-tab vault lock propagation.
  // SSR is disabled for this app so BroadcastChannel is always available.
  const vaultChannel = new BroadcastChannel('clareifi-vault');

  // Auth guard: re-evaluate whenever the session state or route changes.
  // If the vault is locked and we're not on a public route, redirect.
  $effect(() => {
    const currentPath = page.url.pathname;
    const isPublic = PUBLIC_ROUTES.includes(currentPath) || currentPath.startsWith('/about');

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
</script>

<div class="app-shell">
  {#if session.isUnlocked}
    <header class="app-header">
      <a href="/" class="app-wordmark">clareifi notes</a>
      <div class="header-right">
        <span class="vault-status">🔓 vault unlocked</span>
        <button
          class="lock-btn"
          onclick={async () => {
            session.clearSession();
            vaultChannel.postMessage({ type: 'vault-locked' });
            try {
              await supabase.auth.signOut({ scope: 'local' });
            } catch (e) {
              console.warn('signOut failed on vault lock', e);
              // proceed anyway — local state is already zeroed
            }
            goto('/unlock');
          }}
        >
          lock vault
        </button>
      </div>
    </header>
  {/if}

  <main class="app-main">
    {@render children()}
  </main>
</div>

<style>
  .app-shell {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    background: var(--bg);
    color: var(--text);
  }

  .app-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 1.5rem;
    border-bottom: 1px solid var(--border);
  }

  .app-wordmark {
    font-family: var(--font-mono);
    font-size: 0.75rem;
    color: var(--muted);
    text-decoration: none;
    transition: color 0.15s;
  }
  .app-wordmark:hover { color: var(--text); }

  .header-right {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .vault-status {
    font-family: var(--font-mono);
    font-size: 0.7rem;
    color: #4ade80; /* green-400 */
  }

  .lock-btn {
    font-family: var(--font-mono);
    font-size: 0.7rem;
    color: var(--muted);
    background: none;
    border: none;
    cursor: pointer;
    padding: 0;
    transition: color 0.15s;
  }
  .lock-btn:hover { color: var(--text); }

  .app-main {
    flex: 1;
  }
</style>
