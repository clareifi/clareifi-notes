<!-- Notes workspace — main view after vault unlock -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { session } from '$lib/stores.svelte.js';
  import { getAllNotes, getVaultConfig, saveVaultConfig, syncVaultConfigToSupabase } from '$lib/storage.js';
  import { decryptNoteTitleOnly } from '$lib/notesCrypto.js';
  import { rotateVaultKek } from '$lib/crypto.js';
  import { supabase } from '$lib/supabase.js';
  import type { EncryptedNote } from '$lib/types.js';

  interface NoteListItem {
    note: EncryptedNote;
    title: string;
    isUntitled: boolean;
  }

  let notesWithTitles = $state<NoteListItem[]>([]);
  let loading = $state(true);
  let searchQuery = $state('');
  let selectedId = $state<string | null>(null);

  // Envelope key rotation modal state
  let showKeyModal = $state(false);
  let newVaultPassword = $state('');
  let confirmNewVaultPassword = $state('');
  let rotatingKey = $state(false);
  let rotationMessage = $state('');
  let rotationError = $state('');

  let filteredNotes = $derived.by(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return notesWithTitles;
    return notesWithTitles.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.note.id.toLowerCase().includes(q)
    );
  });

  onMount(async () => {
    const activeDek = session.dek ?? session.masterKey;
    if (session.isUnlocked && activeDek) {
      const allNotes = await getAllNotes();
      const fallbackKek = session.kek;

      notesWithTitles = await Promise.all(
        allNotes.map(async (note) => {
          let title = 'Untitled note';
          let isUntitled = true;
          if (note.titleCiphertext && note.titleIv) {
            try {
              const decrypted = await decryptNoteTitleOnly(note, activeDek, fallbackKek);
              if (decrypted && decrypted.trim()) {
                title = decrypted.trim();
                isUntitled = false;
              }
            } catch {
              // keep "Untitled note" fallback
            }
          }
          return { note, title, isUntitled };
        })
      );
      if (notesWithTitles.length > 0) {
        selectedId = notesWithTitles[0].note.id;
      }
    }
    loading = false;
  });

  function formatRelativeTime(iso: string): string {
    const date = new Date(iso);
    const now = Date.now();
    const diffSec = Math.max(0, Math.floor((now - date.getTime()) / 1000));

    if (diffSec < 45) return 'Edited just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `Edited ${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `Edited ${diffHr}h ago`;
    const diffDay = Math.floor(diffHr / 24);
    if (diffDay < 7) return `Edited ${diffDay}d ago`;

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
    });
  }

  function formatFullDate(iso: string): string {
    return new Date(iso).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  async function handleRotatePassword(e: SubmitEvent) {
    e.preventDefault();
    rotationError = '';
    rotationMessage = '';

    if (newVaultPassword.length < 8) {
      rotationError = 'New password must be at least 8 characters.';
      return;
    }
    if (newVaultPassword !== confirmNewVaultPassword) {
      rotationError = 'Passwords do not match.';
      return;
    }

    const config = await getVaultConfig();
    if (!config?.wrappedDek || !config?.dekIv || !session.kek) {
      rotationError = 'Envelope key metadata unavailable. Re-unlock your vault first.';
      return;
    }

    rotatingKey = true;
    try {
      const rotated = await rotateVaultKek(
        config.wrappedDek,
        config.dekIv,
        session.kek,
        newVaultPassword
      );

      const updatedConfig = {
        ...config,
        version: 2 as const,
        salt: rotated.newSalt,
        authHash: rotated.newAuthHash,
        wrappedDek: rotated.newWrappedDek,
        dekIv: rotated.newDekIv,
        updatedAt: new Date().toISOString(),
      };

      await saveVaultConfig(updatedConfig);
      session.setMasterKey(rotated.unwrappedDek, rotated.newKek);

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await syncVaultConfigToSupabase(user.id, updatedConfig);
      }

      newVaultPassword = '';
      confirmNewVaultPassword = '';
      rotationMessage = 'Vault KEK rotated. DEK re-wrapped with 0 note re-encryptions.';
    } catch (err) {
      console.error(err);
      rotationError = 'Failed to rotate envelope key.';
    } finally {
      rotatingKey = false;
    }
  }
</script>

<svelte:head>
  <title>Vault — Clareifi Notes</title>
</svelte:head>

<div class="max-w-4xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-10">
  <!-- Workspace Header -->
  <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-neutral-800/80">
    <div>
      <div class="flex items-center gap-2.5">
        <h1 class="text-xl font-semibold tracking-tight text-[var(--text)]">Notes</h1>
        <span class="rounded-full border border-neutral-800 bg-[var(--surface)] px-2.5 py-0.5 text-xs font-mono text-[var(--muted)] tabular-nums">
          {loading ? '…' : `${notesWithTitles.length} ${notesWithTitles.length === 1 ? 'note' : 'notes'}`}
        </span>
      </div>
      <p class="mt-1 text-xs font-mono text-[var(--muted)]">
        Vault unlocked · {notesWithTitles.length} {notesWithTitles.length === 1 ? 'note' : 'notes'} · decrypted in client RAM only
      </p>
    </div>

    <div class="flex items-center gap-2.5">
      <button
        type="button"
        onclick={() => {
          rotationError = '';
          rotationMessage = '';
          showKeyModal = true;
        }}
        class="inline-flex items-center gap-1.5 rounded-lg border border-neutral-800 bg-[var(--surface)] hover:border-neutral-700 px-3 py-2 text-xs font-mono text-[var(--text-secondary)] hover:text-[var(--text)] transition duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60"
      >
        <svg class="w-3.5 h-3.5 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"></path>
        </svg>
        <span>envelope key</span>
      </button>

      <a
        href="/notes/new"
        class="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-500 text-neutral-950 font-medium text-xs sm:text-sm px-3.5 py-2 transition duration-150 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950"
      >
        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
          <line x1="12" y1="5" x2="12" y2="19"></line>
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
        <span>New Note</span>
      </a>
    </div>
  </div>

  <!-- Search / Filter Bar (when notes exist) -->
  {#if !loading && notesWithTitles.length > 0}
    <div class="mt-5 mb-4 flex items-center gap-3">
      <div class="relative flex-1">
        <svg
          class="w-4 h-4 text-[var(--muted)] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
        <input
          type="search"
          bind:value={searchQuery}
          placeholder="Search decrypted titles locally…"
          aria-label="Search decrypted titles locally"
          class="w-full rounded-lg border border-neutral-800 bg-[var(--surface)] pl-10 pr-4 py-2 text-sm text-[var(--text)] placeholder:text-[var(--muted)] transition duration-150 focus:border-emerald-500/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
        />
      </div>
    </div>
  {/if}

  <!-- Content States -->
  <div class="mt-6">
    {#if loading}
      <!-- Skeleton Screen -->
      <div class="space-y-2.5" aria-busy="true" aria-label="Decrypting note index">
        <div class="flex items-center justify-between text-xs font-mono text-[var(--muted)] mb-3">
          <span>Decrypting local note index…</span>
          <span>AES-256-GCM</span>
        </div>
        {#each [1, 2, 3, 4] as item (item)}
          <div class="rounded-xl border border-neutral-800/80 bg-[var(--surface)] p-4 flex items-center justify-between animate-pulse">
            <div class="space-y-2">
              <div class="h-4 w-48 rounded bg-neutral-800"></div>
              <div class="h-3 w-24 rounded bg-neutral-800/60"></div>
            </div>
            <div class="h-3 w-20 rounded bg-neutral-800/60"></div>
          </div>
        {/each}
      </div>

    {:else if notesWithTitles.length === 0}
      <!-- Zero-Knowledge Empty State -->
      <div class="rounded-2xl border border-dashed border-neutral-800 bg-[var(--surface)]/50 px-6 py-16 text-center">
        <div class="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-400">
          <svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
          </svg>
        </div>
        <p class="text-xs font-mono uppercase tracking-wider text-emerald-400 mb-1">
          Vault unlocked · 0 notes
        </p>
        <h2 class="text-base font-medium text-[var(--text)] mb-2">
          Your zero-knowledge workspace is ready
        </h2>
        <p class="max-w-md mx-auto text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed mb-6">
          Every note you write is encrypted with a unique 96-bit random IV and 256-bit AES-GCM key before touching IndexedDB or cloud storage.
        </p>
        <a
          href="/notes/new"
          class="inline-flex items-center gap-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-medium text-xs sm:text-sm px-4 py-2.5 transition duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
        >
          <span>Create your first encrypted note</span>
          <span>→</span>
        </a>
      </div>

    {:else if filteredNotes.length === 0}
      <div class="rounded-xl border border-neutral-800 bg-[var(--surface)]/40 py-12 text-center">
        <p class="text-sm text-[var(--text-secondary)]">No notes match "{searchQuery}"</p>
        <button
          type="button"
          onclick={() => (searchQuery = '')}
          class="mt-2 text-xs font-mono text-emerald-400 hover:underline"
        >
          Clear search filter
        </button>
      </div>

    {:else}
      <ul class="space-y-2" role="list">
        {#each filteredNotes as { note, title, isUntitled } (note.id)}
          {@const isSelected = selectedId === note.id}
          <li>
            <a
              href="/notes/{note.id}"
              onmouseenter={() => (selectedId = note.id)}
              onfocus={() => (selectedId = note.id)}
              class="group flex items-center justify-between gap-4 rounded-xl border px-4 py-3.5 transition duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 {isSelected
                ? 'border-neutral-700 bg-[var(--surface-hover)] shadow-sm'
                : 'border-neutral-800/80 bg-[var(--surface)] hover:border-neutral-700 hover:bg-[var(--surface-hover)]'}"
            >
              <div class="min-w-0 flex-1">
                <span
                  class="block truncate text-sm font-medium transition duration-150 {isUntitled
                    ? 'italic text-[var(--muted)] group-hover:text-[var(--text-secondary)]'
                    : 'text-[var(--text)]'}"
                >
                  {title}
                </span>
              </div>

              <div class="flex items-center gap-3 shrink-0">
                <time
                  datetime={note.updatedAt}
                  title={formatFullDate(note.updatedAt)}
                  class="text-xs font-mono text-[var(--muted)] group-hover:text-[var(--text-secondary)] tabular-nums transition duration-150"
                >
                  {formatRelativeTime(note.updatedAt)}
                </time>
                <span class="text-[var(--muted)] group-hover:text-emerald-400 group-hover:translate-x-0.5 transition duration-150 text-xs font-mono">
                  →
                </span>
              </div>
            </a>
          </li>
        {/each}
      </ul>
    {/if}
  </div>
</div>

<!-- Phase 3 Envelope Key & Password Rotation Modal -->
{#if showKeyModal}
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4"
    role="dialog"
    aria-modal="true"
    aria-label="Envelope Key Architecture"
  >
    <div class="w-full max-w-md rounded-xl border border-neutral-800 bg-[var(--surface)] p-6 shadow-2xl">
      <div class="flex items-center justify-between mb-4">
        <div class="flex items-center gap-2">
          <span class="h-2 w-2 rounded-full bg-emerald-400"></span>
          <h2 class="text-sm font-mono font-semibold text-[var(--text)]">
            Phase 3 · Envelope Key Architecture
          </h2>
        </div>
        <button
          type="button"
          onclick={() => (showKeyModal = false)}
          class="text-xs font-mono text-[var(--muted)] hover:text-[var(--text)] px-1.5 py-0.5"
        >
          ✕
        </button>
      </div>

      <p class="text-xs text-[var(--text-secondary)] leading-relaxed mb-4">
        Your notes are encrypted with a dedicated 256-bit Data Encryption Key (DEK). Your password derives a Key Encryption Key (KEK) that wraps the DEK in <code class="font-mono text-emerald-400">vault_config</code>. Rotating your password re-wraps the DEK without re-encrypting your notes.
      </p>

      <form onsubmit={handleRotatePassword} class="space-y-3">
        <div>
          <label for="new-kek-pass" class="block text-xs font-mono text-[var(--text-secondary)] mb-1">
            new vault password
          </label>
          <input
            id="new-kek-pass"
            type="password"
            bind:value={newVaultPassword}
            placeholder="Min. 8 characters"
            autocomplete="new-password"
            class="w-full rounded-lg border border-neutral-800 bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)] focus:border-emerald-500/60 focus:outline-none"
          />
        </div>

        <div>
          <label for="confirm-kek-pass" class="block text-xs font-mono text-[var(--text-secondary)] mb-1">
            confirm new password
          </label>
          <input
            id="confirm-kek-pass"
            type="password"
            bind:value={confirmNewVaultPassword}
            placeholder="Repeat new password"
            autocomplete="new-password"
            class="w-full rounded-lg border border-neutral-800 bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)] focus:border-emerald-500/60 focus:outline-none"
          />
        </div>

        {#if rotationError}
          <p class="text-xs font-mono text-red-400">{rotationError}</p>
        {/if}
        {#if rotationMessage}
          <p class="text-xs font-mono text-emerald-400">{rotationMessage}</p>
        {/if}

        <div class="pt-2 flex items-center justify-end gap-2">
          <button
            type="button"
            onclick={() => (showKeyModal = false)}
            class="rounded-lg border border-neutral-800 px-3 py-1.5 text-xs font-mono text-[var(--muted)] hover:text-[var(--text)] transition duration-150"
          >
            close
          </button>
          <button
            type="submit"
            disabled={rotatingKey}
            class="rounded-lg bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-medium text-xs px-3.5 py-1.5 transition duration-150 disabled:opacity-50"
          >
            {rotatingKey ? 'Re-wrapping DEK…' : 'Rotate Vault KEK'}
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}
