<!-- Create new encrypted note -->
<script lang="ts">
  import { goto } from '$app/navigation';
  import { session } from '$lib/stores.svelte.js';
  import { encryptNote } from '$lib/crypto.js';
  import { encryptNoteEnvelope } from '$lib/notesCrypto.js';
  import { saveNote } from '$lib/storage.js';
  import type { EncryptedNote } from '$lib/types.js';

  let title = $state('');
  let content = $state('');
  let saving = $state(false);
  let error = $state('');
  let lastKeystrokeAt = $state<number | null>(null);

  let wordCount = $derived.by(() => {
    const trimmed = content.trim();
    if (!trimmed) return 0;
    return trimmed.split(/\s+/).length;
  });

  let keystrokeStatus = $derived.by(() => {
    if (saving) return 'Encrypting locally · Syncing ciphertext…';
    if (!content.trim() && !title.trim()) return 'RAM buffer ready · AES-256-GCM';
    if (lastKeystrokeAt) return 'Draft in client RAM · Press ⌘S to encrypt & save';
    return 'Ready to encrypt';
  });

  function onInputResize(e: Event) {
    lastKeystrokeAt = Date.now();
    const target = e.currentTarget as HTMLTextAreaElement;
    if (target) {
      target.style.height = 'auto';
      target.style.height = `${Math.max(360, target.scrollHeight)}px`;
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      if (content.trim() && !saving) {
        save();
      }
    }
  }

  async function save() {
    if (!content.trim()) return;
    if (!session.masterKey) {
      goto('/unlock');
      return;
    }

    saving = true;
    error = '';

    try {
      const trimmedTitle = title.trim();
      const now = new Date().toISOString();

      // Encrypt content & title with fresh random IVs and envelope DEK metadata
      const envelope = await encryptNoteEnvelope(
        content,
        trimmedTitle || undefined,
        session.masterKey
      );

      // Also encrypt under session.masterKey for backwards-compatible cloud sync
      // on Phase 2 Supabase tables that do not yet store wrapped_dek per note row
      const [{ iv, ciphertext }, titleEncrypted] = await Promise.all([
        encryptNote(content, session.masterKey),
        trimmedTitle
          ? encryptNote(trimmedTitle, session.masterKey)
          : Promise.resolve(undefined),
      ]);

      const note: EncryptedNote = {
        id: crypto.randomUUID(),
        version: 1,
        iv,
        ciphertext,
        titleIv: titleEncrypted?.iv,
        titleCiphertext: titleEncrypted?.ciphertext,
        wrappedDek: envelope.wrappedDek,
        wrapIv: envelope.wrapIv,
        createdAt: now,
        updatedAt: now,
      };

      await saveNote(note);
      goto(`/notes/${note.id}`);
    } catch (err) {
      console.error(err);
      error = 'Failed to encrypt and save note. Please try again.';
      saving = false;
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<svelte:head>
  <title>{title.trim() ? `${title.trim()} — New Note` : 'New Note — Clareifi Notes'}</title>
</svelte:head>

<div class="max-w-3xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-10 flex-1 flex flex-col">
  <!-- Top Toolbar -->
  <div class="flex items-center justify-between gap-4 pb-4 mb-6 border-b border-neutral-800/80">
    <a
      href="/"
      class="inline-flex items-center gap-1.5 text-xs font-mono text-[var(--muted)] hover:text-[var(--text)] transition duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 rounded px-1 py-0.5"
    >
      <span>←</span>
      <span>all notes</span>
    </a>

    <div class="flex items-center gap-3">
      <span class="inline-flex items-center gap-1.5 text-[11px] font-mono text-[var(--muted)]">
        <span class="h-1.5 w-1.5 rounded-full {saving ? 'bg-amber-400 animate-ping' : content.trim() ? 'bg-emerald-400' : 'bg-neutral-600'}"></span>
        <span>{keystrokeStatus}</span>
      </span>
    </div>
  </div>

  <!-- Distraction-Free Editor Surface -->
  <div class="flex-1 flex flex-col rounded-xl border border-neutral-800/90 bg-[var(--surface)] p-5 sm:p-8 shadow-lg">
    <input
      type="text"
      bind:value={title}
      oninput={() => (lastKeystrokeAt = Date.now())}
      placeholder="Untitled note"
      aria-label="Note title"
      class="w-full bg-transparent border-0 border-b border-neutral-800/70 pb-3.5 mb-4 text-lg sm:text-xl font-semibold tracking-tight text-[var(--text)] placeholder:text-neutral-600 focus:border-emerald-500/50 focus:outline-none transition duration-150"
    />

    <textarea
      bind:value={content}
      oninput={onInputResize}
      placeholder="Write in complete privacy… Markdown supported."
      aria-label="Note content"
      class="w-full flex-1 min-h-[360px] bg-transparent border-0 resize-none text-sm sm:text-base text-[var(--text)] placeholder:text-neutral-600 leading-relaxed font-mono focus:outline-none"
    ></textarea>

    {#if error}
      <div
        role="alert"
        class="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-xs font-mono text-red-300"
      >
        {error}
      </div>
    {/if}

    <!-- Editor Footer Bar -->
    <div class="mt-6 pt-4 border-t border-neutral-800/80 flex flex-wrap items-center justify-between gap-4">
      <div class="flex items-center gap-4 text-xs font-mono text-[var(--muted)] tabular-nums">
        <span>{wordCount} {wordCount === 1 ? 'word' : 'words'}</span>
        <span>·</span>
        <span>{content.length} chars</span>
        <span class="hidden sm:inline">·</span>
        <span class="hidden sm:inline text-emerald-400/80">unique 96-bit IV on save</span>
      </div>

      <div class="flex items-center gap-2.5">
        <a
          href="/"
          class="rounded-lg border border-neutral-800 px-3 py-2 text-xs font-mono text-[var(--muted)] hover:text-[var(--text)] hover:border-neutral-700 transition duration-150"
        >
          cancel
        </a>
        <button
          type="button"
          onclick={save}
          disabled={saving || !content.trim()}
          class="inline-flex items-center gap-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-500 text-neutral-950 font-medium text-xs sm:text-sm px-4 py-2 transition duration-150 disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
        >
          {#if saving}
            <span class="h-3.5 w-3.5 rounded-full border-2 border-neutral-950/30 border-t-neutral-950 animate-spin"></span>
            <span>Encrypting…</span>
          {:else}
            <span>Encrypt & Save</span>
          {/if}
        </button>
      </div>
    </div>
  </div>
</div>
