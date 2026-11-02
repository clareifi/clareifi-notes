<!-- Phase 3 Scaffolding: Selective Note Sharing via Encrypted URL Fragment (#key=...) -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/state';
  import { extractShareKeyFromHash, decryptSharedPackage } from '$lib/shareCrypto.js';
  import type { SharedNotePayload } from '$lib/types.js';

  let loading = $state(true);
  let error = $state('');
  let title = $state('');
  let content = $state('');
  let sharedAt = $state('');

  onMount(async () => {
    const shareId = page.params.id;
    const fragmentKey = extractShareKeyFromHash(window.location.hash);

    if (!fragmentKey) {
      error = 'Missing decryption key in URL fragment (#key=...). The server never receives or stores share keys.';
      loading = false;
      return;
    }

    if (!shareId) {
      error = 'Invalid shared note identifier.';
      loading = false;
      return;
    }

    try {
      const rawPayload = sessionStorage.getItem(`clareifi_share_${shareId}`);
      if (!rawPayload) {
        error = 'Encrypted share snapshot not found or expired.';
        loading = false;
        return;
      }

      const payload: SharedNotePayload = JSON.parse(rawPayload);
      const decrypted = await decryptSharedPackage(payload, fragmentKey);
      content = decrypted.content;
      title = decrypted.title ?? 'Untitled shared note';
      sharedAt = payload.createdAt;
    } catch (err) {
      console.error(err);
      error = 'Decryption failed. The URL #key fragment is invalid or the ciphertext was tampered with.';
    } finally {
      loading = false;
    }
  });
</script>

<svelte:head>
  <title>{title ? `${title} — Shared Encrypted Note` : 'Shared Note — Clareifi Notes'}</title>
</svelte:head>

<div class="max-w-3xl w-full mx-auto px-4 sm:px-6 py-10 sm:py-16">
  <div class="mb-4 flex items-center justify-between">
    <span class="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 text-[11px] font-mono text-emerald-400">
      <span class="h-1.5 w-1.5 rounded-full bg-emerald-400"></span>
      decrypted client-side via #key fragment
    </span>

    <a
      href="/"
      class="text-xs font-mono text-[var(--muted)] hover:text-[var(--text)] transition duration-150"
    >
      clareifi vault →
    </a>
  </div>

  <div class="rounded-2xl border border-neutral-800 bg-[var(--surface)] p-6 sm:p-8 shadow-xl">
    {#if loading}
      <div class="space-y-3 animate-pulse">
        <div class="h-5 w-1/2 rounded bg-neutral-800"></div>
        <div class="h-4 w-full rounded bg-neutral-800/70"></div>
        <div class="h-4 w-4/5 rounded bg-neutral-800/70"></div>
      </div>
    {:else if error}
      <div role="alert" class="rounded-xl border border-red-500/30 bg-red-500/10 p-5 text-xs font-mono text-red-300">
        {error}
      </div>
    {:else}
      <div class="pb-4 mb-5 border-b border-neutral-800/80 flex items-center justify-between gap-4">
        <h1 class="text-lg sm:text-xl font-semibold text-[var(--text)]">{title}</h1>
        {#if sharedAt}
          <time datetime={sharedAt} class="text-xs font-mono text-[var(--muted)] tabular-nums">
            {new Date(sharedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </time>
        {/if}
      </div>

      <div class="font-mono text-sm sm:text-base text-[var(--text)] whitespace-pre-wrap leading-relaxed">
        {content}
      </div>
    {/if}
  </div>
</div>
