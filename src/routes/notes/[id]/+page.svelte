<!-- View / Edit / Delete / Zero-Knowledge Share note -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { session } from '$lib/stores.svelte.js';
  import { encryptNote } from '$lib/crypto.js';
  import { decryptNoteWithVersion, encryptNoteEnvelope } from '$lib/notesCrypto.js';
  import { createEncryptedSharePackage } from '$lib/shareCrypto.js';
  import { getNote, saveNote, deleteNote } from '$lib/storage.js';
  import type { EncryptedNote } from '$lib/types.js';

  // Component state
  let note = $state<EncryptedNote | null>(null);
  let decrypted = $state('');
  let decryptedTitle = $state('');
  let editContent = $state('');
  let editTitle = $state('');
  let mode = $state<'view' | 'edit'>('view');
  let loading = $state(true);
  let saving = $state(false);
  let syncStatus = $state<'synced' | 'editing' | 'encrypting'>('synced');
  let showDeleteConfirm = $state(false);
  let error = $state('');

  // Phase 3 Selective Sharing state (#key=...)
  let showShareModal = $state(false);
  let generatingShare = $state(false);
  let shareUrl = $state('');
  let shareCopied = $state(false);

  let wordCount = $derived.by(() => {
    const text = mode === 'edit' ? editContent : decrypted;
    const trimmed = text.trim();
    if (!trimmed) return 0;
    return trimmed.split(/\s+/).length;
  });

  onMount(async () => {
    if (!session.masterKey) {
      goto('/unlock');
      return;
    }

    const id = page.params.id;
    if (!id) {
      goto('/');
      return;
    }

    const fetched = await getNote(id);
    if (!fetched) {
      goto('/');
      return;
    }

    try {
      note = fetched;
      const activeDek = session.dek ?? session.masterKey;
      const result = await decryptNoteWithVersion(fetched, activeDek, session.kek);
      decrypted = result.content;
      decryptedTitle = result.title ?? '';
      editContent = decrypted;
      editTitle = decryptedTitle;
    } catch (err) {
      console.error(err);
      error = 'Unable to decrypt note. The encryption key may not match this record.';
    } finally {
      loading = false;
    }
  });

  function handleKeydown(e: KeyboardEvent) {
    if (mode === 'edit') {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (editContent.trim() && !saving) {
          saveEdit();
        }
      } else if (e.key === 'Escape' && !saving) {
        cancelEdit();
      }
    }
  }

  function onInputResize(e: Event) {
    syncStatus = 'editing';
    const target = e.currentTarget as HTMLTextAreaElement;
    if (target) {
      target.style.height = 'auto';
      target.style.height = `${Math.max(320, target.scrollHeight)}px`;
    }
  }

  async function saveEdit() {
    if (!note || !session.masterKey || !editContent.trim()) return;
    saving = true;
    syncStatus = 'encrypting';
    error = '';

    try {
      const trimmedTitle = editTitle.trim();
      const envelope = await encryptNoteEnvelope(
        editContent,
        trimmedTitle || undefined,
        session.masterKey
      );

      // Re-encrypt with fresh random 12-byte IVs — never reuse original IVs
      const [{ iv, ciphertext }, titleEncrypted] = await Promise.all([
        encryptNote(editContent, session.masterKey),
        trimmedTitle
          ? encryptNote(trimmedTitle, session.masterKey)
          : Promise.resolve(undefined),
      ]);

      const updated: EncryptedNote = {
        ...note,
        version: 1,
        iv,
        ciphertext,
        titleIv: titleEncrypted?.iv,
        titleCiphertext: titleEncrypted?.ciphertext,
        wrappedDek: envelope.wrappedDek,
        wrapIv: envelope.wrapIv,
        updatedAt: new Date().toISOString(),
      };

      await saveNote(updated);
      note = updated;
      decrypted = editContent;
      decryptedTitle = trimmedTitle;
      syncStatus = 'synced';
      mode = 'view';
    } catch (err) {
      console.error(err);
      error = 'Failed to re-encrypt and save changes. Please try again.';
      syncStatus = 'editing';
    } finally {
      saving = false;
    }
  }

  async function confirmDelete() {
    if (!note) return;
    await deleteNote(note.id);
    goto('/');
  }

  function enterEdit() {
    editContent = decrypted;
    editTitle = decryptedTitle;
    syncStatus = 'editing';
    mode = 'edit';
  }

  function cancelEdit() {
    editContent = decrypted;
    editTitle = decryptedTitle;
    syncStatus = 'synced';
    mode = 'view';
  }

  async function openShareModal() {
    if (!decrypted) return;
    showShareModal = true;
    generatingShare = true;
    shareCopied = false;
    try {
      const { payload, fragmentKey } = await createEncryptedSharePackage(
        decrypted,
        decryptedTitle || undefined
      );
      // Persist ciphertext-only payload in sessionStorage for local Phase 3 preview route
      sessionStorage.setItem(`clareifi_share_${payload.id}`, JSON.stringify(payload));
      const origin = typeof window !== 'undefined' ? window.location.origin : 'https://clareifi.xyz';
      shareUrl = `${origin}/s/${payload.id}#key=${fragmentKey}`;
    } catch (err) {
      console.error(err);
    } finally {
      generatingShare = false;
    }
  }

  async function copyShareLink() {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    shareCopied = true;
  }

  function formatDate(iso: string): string {
    return new Date(iso).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function formatRelativeTime(iso: string): string {
    const diffSec = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
    if (diffSec < 45) return 'Edited just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `Edited ${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `Edited ${diffHr}h ago`;
    return `Edited ${Math.floor(diffHr / 24)}d ago`;
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<svelte:head>
  <title>{decryptedTitle ? `${decryptedTitle} — Clareifi Notes` : 'Untitled note — Clareifi Notes'}</title>
</svelte:head>

<div class="max-w-3xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-10 flex-1 flex flex-col">
  <!-- Top Toolbar -->
  <div class="flex flex-wrap items-center justify-between gap-3 pb-4 mb-6 border-b border-neutral-800/80">
    <a
      href="/"
      class="inline-flex items-center gap-1.5 text-xs font-mono text-[var(--muted)] hover:text-[var(--text)] transition duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 rounded px-1 py-0.5"
    >
      <span>←</span>
      <span>all notes</span>
    </a>

    <div class="flex items-center gap-3">
      <!-- Live Sync & Encryption Status Indicator -->
      <span class="inline-flex items-center gap-1.5 rounded-full border border-neutral-800 bg-[var(--surface)] px-2.5 py-1 text-[11px] font-mono text-[var(--muted)]">
        {#if syncStatus === 'encrypting'}
          <span class="h-1.5 w-1.5 rounded-full bg-amber-400 animate-ping"></span>
          <span>Encrypting with fresh IV…</span>
        {:else if syncStatus === 'editing'}
          <span class="h-1.5 w-1.5 rounded-full bg-amber-400"></span>
          <span>Unsaved edits in RAM · ⌘S</span>
        {:else}
          <span class="h-1.5 w-1.5 rounded-full bg-emerald-400"></span>
          <span>Saved locally · Synced</span>
        {/if}
      </span>

      {#if mode === 'view' && note && !loading}
        <div class="flex items-center gap-1.5">
          <button
            type="button"
            onclick={openShareModal}
            class="inline-flex items-center gap-1 rounded-lg border border-neutral-800 bg-[var(--surface)] hover:border-neutral-700 px-2.5 py-1.5 text-xs font-mono text-[var(--text-secondary)] hover:text-[var(--text)] transition duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60"
            title="Zero-knowledge share link (#key=...)"
          >
            <span>share</span>
          </button>
          <button
            type="button"
            onclick={enterEdit}
            class="inline-flex items-center gap-1 rounded-lg border border-neutral-800 bg-[var(--surface)] hover:border-neutral-700 px-3 py-1.5 text-xs font-mono text-[var(--text)] transition duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60"
          >
            <span>edit</span>
          </button>
          <button
            type="button"
            onclick={() => (showDeleteConfirm = true)}
            class="inline-flex items-center gap-1 rounded-lg border border-red-500/20 bg-red-500/10 hover:bg-red-500/20 px-2.5 py-1.5 text-xs font-mono text-red-400 transition duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/50"
          >
            <span>delete</span>
          </button>
        </div>
      {/if}
    </div>
  </div>

  <!-- Loading Skeleton -->
  {#if loading}
    <div class="rounded-xl border border-neutral-800 bg-[var(--surface)] p-6 sm:p-8 space-y-4 animate-pulse" aria-busy="true">
      <div class="flex items-center justify-between">
        <div class="h-3 w-32 rounded bg-neutral-800"></div>
        <div class="h-3 w-24 rounded bg-neutral-800"></div>
      </div>
      <div class="h-6 w-2/3 rounded bg-neutral-800"></div>
      <div class="space-y-2 pt-4">
        <div class="h-4 w-full rounded bg-neutral-800/70"></div>
        <div class="h-4 w-11/12 rounded bg-neutral-800/70"></div>
        <div class="h-4 w-4/5 rounded bg-neutral-800/70"></div>
      </div>
    </div>

  <!-- Decryption Error State -->
  {:else if error && !decrypted && mode === 'view'}
    <div role="alert" class="rounded-xl border border-red-500/30 bg-red-500/10 p-6 text-center">
      <p class="text-sm font-mono text-red-300 mb-3">{error}</p>
      <a href="/" class="text-xs font-mono text-emerald-400 hover:underline">← Return to notes list</a>
    </div>

  <!-- Note Surface -->
  {:else if note}
    <div class="flex-1 flex flex-col rounded-xl border border-neutral-800/90 bg-[var(--surface)] p-5 sm:p-8 shadow-lg">
      <!-- Metadata Bar -->
      <div class="flex flex-wrap items-center justify-between gap-2 pb-4 mb-5 border-b border-neutral-800/70 text-[11px] font-mono text-[var(--muted)] tabular-nums">
        <div class="flex items-center gap-3">
          <span class="rounded border border-neutral-800 bg-[var(--bg)] px-1.5 py-0.5">
            id: {note.id.slice(0, 8)}
          </span>
          <span>{formatRelativeTime(note.updatedAt)}</span>
        </div>
        <div class="flex items-center gap-3">
          <span title="Created timestamp">created {formatDate(note.createdAt)}</span>
          <span>·</span>
          <span title="Last updated timestamp">updated {formatDate(note.updatedAt)}</span>
        </div>
      </div>

      {#if error}
        <div role="alert" class="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-xs font-mono text-red-300">
          {error}
        </div>
      {/if}

      <!-- View Mode -->
      {#if mode === 'view'}
        <h1
          class="text-lg sm:text-xl font-semibold tracking-tight mb-4 {decryptedTitle
            ? 'text-[var(--text)]'
            : 'italic text-[var(--muted)]'}"
        >
          {decryptedTitle || 'Untitled note'}
        </h1>

        <div class="flex-1 font-mono text-sm sm:text-base text-[var(--text)] whitespace-pre-wrap leading-relaxed min-h-[240px]">
          {decrypted}
        </div>

        <div class="mt-8 pt-4 border-t border-neutral-800/70 flex items-center justify-between text-xs font-mono text-[var(--muted)] tabular-nums">
          <span>{wordCount} {wordCount === 1 ? 'word' : 'words'} · {decrypted.length} chars</span>
          <span class="text-emerald-400/80">AES-256-GCM · Authenticated</span>
        </div>

      <!-- Edit Mode -->
      {:else}
        <input
          type="text"
          bind:value={editTitle}
          oninput={() => (syncStatus = 'editing')}
          placeholder="Untitled note"
          aria-label="Note title"
          class="w-full bg-transparent border-0 border-b border-neutral-800/70 pb-3.5 mb-4 text-lg sm:text-xl font-semibold tracking-tight text-[var(--text)] placeholder:text-neutral-600 focus:border-emerald-500/50 focus:outline-none transition duration-150"
        />

        <textarea
          bind:value={editContent}
          oninput={onInputResize}
          aria-label="Note content"
          class="w-full flex-1 min-h-[320px] bg-transparent border-0 resize-none text-sm sm:text-base text-[var(--text)] leading-relaxed font-mono focus:outline-none"
        ></textarea>

        <div class="mt-6 pt-4 border-t border-neutral-800/80 flex flex-wrap items-center justify-between gap-4">
          <div class="text-xs font-mono text-[var(--muted)] tabular-nums">
            <span>{wordCount} {wordCount === 1 ? 'word' : 'words'} · {editContent.length} chars</span>
          </div>

          <div class="flex items-center gap-2.5">
            <button
              type="button"
              onclick={cancelEdit}
              class="rounded-lg border border-neutral-800 px-3 py-2 text-xs font-mono text-[var(--muted)] hover:text-[var(--text)] hover:border-neutral-700 transition duration-150"
            >
              cancel (esc)
            </button>
            <button
              type="button"
              onclick={saveEdit}
              disabled={saving || !editContent.trim()}
              class="inline-flex items-center gap-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-500 text-neutral-950 font-medium text-xs sm:text-sm px-4 py-2 transition duration-150 disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
            >
              {#if saving}
                <span class="h-3.5 w-3.5 rounded-full border-2 border-neutral-950/30 border-t-neutral-950 animate-spin"></span>
                <span>Re-encrypting…</span>
              {:else}
                <span>Save Changes</span>
              {/if}
            </button>
          </div>
        </div>
      {/if}
    </div>
  {/if}
</div>

<!-- Delete Confirmation Modal -->
{#if showDeleteConfirm}
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4"
    role="dialog"
    aria-modal="true"
    aria-label="Confirm delete note"
  >
    <div class="w-full max-w-sm rounded-xl border border-neutral-800 bg-[var(--surface)] p-6 shadow-2xl">
      <h2 class="text-base font-semibold text-[var(--text)] mb-2">Delete this encrypted note?</h2>
      <p class="text-xs text-[var(--text-secondary)] leading-relaxed mb-6">
        This action cannot be undone. The ciphertext record will be permanently purged from local IndexedDB and Supabase cloud backup.
      </p>
      <div class="flex items-center justify-end gap-2.5">
        <button
          type="button"
          onclick={() => (showDeleteConfirm = false)}
          class="rounded-lg border border-neutral-800 px-3 py-1.5 text-xs font-mono text-[var(--muted)] hover:text-[var(--text)] transition duration-150"
        >
          cancel
        </button>
        <button
          type="button"
          onclick={confirmDelete}
          class="rounded-lg bg-red-500 hover:bg-red-400 text-neutral-950 font-medium text-xs px-3.5 py-1.5 transition duration-150"
        >
          Delete Permanently
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- Phase 3 Selective Note Sharing Modal (#key=...) -->
{#if showShareModal}
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4"
    role="dialog"
    aria-modal="true"
    aria-label="Zero-Knowledge Share Link"
  >
    <div class="w-full max-w-md rounded-xl border border-neutral-800 bg-[var(--surface)] p-6 shadow-2xl">
      <div class="flex items-center justify-between mb-3">
        <span class="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 text-[11px] font-mono text-emerald-400">
          Phase 3 · Zero-Knowledge Fragment Link
        </span>
        <button
          type="button"
          onclick={() => (showShareModal = false)}
          class="text-xs font-mono text-[var(--muted)] hover:text-[var(--text)] px-1"
        >
          ✕
        </button>
      </div>

      <h2 class="text-base font-semibold text-[var(--text)] mb-2">
        Selective Note Sharing
      </h2>
      <p class="text-xs text-[var(--text-secondary)] leading-relaxed mb-4">
        A dedicated ephemeral 256-bit AES-GCM key was generated for this snapshot. The key is embedded after <code class="font-mono text-emerald-400">#key=</code> — browsers never transmit URI fragments to servers.
      </p>

      {#if generatingShare}
        <div class="h-10 rounded-lg bg-neutral-900 animate-pulse"></div>
      {:else}
        <div class="space-y-3">
          <input
            type="text"
            readonly
            value={shareUrl}
            aria-label="Encrypted share URL"
            class="w-full rounded-lg border border-neutral-800 bg-[var(--bg)] px-3 py-2 text-xs font-mono text-[var(--text-secondary)] select-all focus:outline-none"
          />
          <div class="flex items-center justify-between gap-2">
            <a
              href={shareUrl}
              class="text-xs font-mono text-emerald-400 hover:underline"
            >
              Preview recipient view →
            </a>
            <div class="flex items-center gap-2">
              <button
                type="button"
                onclick={() => (showShareModal = false)}
                class="rounded-lg border border-neutral-800 px-3 py-1.5 text-xs font-mono text-[var(--muted)] hover:text-[var(--text)]"
              >
                close
              </button>
              <button
                type="button"
                onclick={copyShareLink}
                class="rounded-lg bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-medium text-xs px-3.5 py-1.5 transition duration-150"
              >
                {shareCopied ? 'Copied!' : 'Copy #key Link'}
              </button>
            </div>
          </div>
        </div>
      {/if}
    </div>
  </div>
{/if}
