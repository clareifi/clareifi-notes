<!-- View / Edit / Delete note -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { session } from '$lib/stores.svelte.js';
  import { decryptNote, encryptNote } from '$lib/crypto.js';
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
  let showDeleteConfirm = $state(false);
  let error = $state('');

  onMount(async () => {
    if (!session.masterKey) {
      goto('/unlock');
      return;
    }

    const id = page.params.id;
    const fetched = await getNote(id);

    if (!fetched) {
      goto('/');
      return;
    }

    try {
      note = fetched;
      decrypted = await decryptNote(fetched.ciphertext, fetched.iv, session.masterKey);
      if (fetched.titleCiphertext && fetched.titleIv) {
        decryptedTitle = await decryptNote(fetched.titleCiphertext, fetched.titleIv, session.masterKey);
      }
      editContent = decrypted;
      editTitle = decryptedTitle;
    } catch (err) {
      console.error(err);
      error = 'failed to decrypt note — the key may have changed';
    } finally {
      loading = false;
    }
  });

  async function saveEdit() {
    if (!note || !session.masterKey || !editContent.trim()) return;
    saving = true;
    error = '';

    try {
      // Re-encrypt with fresh IVs — never reuse originals
      const [{ iv, ciphertext }, { iv: titleIv, ciphertext: titleCiphertext }] = await Promise.all([
        encryptNote(editContent, session.masterKey),
        encryptNote(editTitle, session.masterKey),
      ]);
      const updated: EncryptedNote = {
        ...note,
        iv,
        ciphertext,
        titleIv,
        titleCiphertext,
        updatedAt: new Date().toISOString(),
      };

      await saveNote(updated);
      note = updated;
      decrypted = editContent;
      decryptedTitle = editTitle;
      mode = 'view';
    } catch (err) {
      console.error(err);
      error = 'failed to save changes — please try again';
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
    mode = 'edit';
  }

  function cancelEdit() {
    editContent = decrypted;
    editTitle = decryptedTitle;
    mode = 'view';
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
</script>

<div class="page">
  <!-- Toolbar -->
  <div class="toolbar">
    <a href="/" class="back-link">← all notes</a>
    {#if mode === 'view' && note && !loading}
      <div class="actions">
        <button onclick={enterEdit} class="action-btn">edit</button>
        <button onclick={() => (showDeleteConfirm = true)} class="action-btn danger">delete</button>
      </div>
    {/if}
  </div>

  <!-- Loading state -->
  {#if loading}
    <p class="hint">decrypting…</p>

  <!-- Error state -->
  {:else if error && !note}
    <p class="err-msg">{error}</p>

  <!-- Note content -->
  {:else if note}
    <!-- Metadata bar -->
    <div class="meta">
      <span>id: {note.id.slice(0, 8)}</span>
      <span>created: {formatDate(note.createdAt)}</span>
      <span>updated: {formatDate(note.updatedAt)}</span>
    </div>

    {#if error}
      <p class="err-msg">{error}</p>
    {/if}

    <!-- View mode -->
    {#if mode === 'view'}
      {#if decryptedTitle}
        <h2 class="note-title">{decryptedTitle}</h2>
      {/if}
      <div class="note-body">{decrypted}</div>

    <!-- Edit mode -->
    {:else}
      <input
        bind:value={editTitle}
        placeholder="title (optional)"
        class="title-input"
      />
      <textarea
        bind:value={editContent}
        autofocus
        class="editor"
      ></textarea>
      <div class="edit-actions">
        <button onclick={cancelEdit} class="action-btn">cancel</button>
        <button onclick={saveEdit} disabled={saving} class="action-btn primary">
          {saving ? 're-encrypting…' : 'save changes'}
        </button>
      </div>
    {/if}
  {/if}
</div>

<!-- Delete confirmation modal -->
{#if showDeleteConfirm}
  <div class="modal-overlay" role="dialog" aria-modal="true" aria-label="confirm delete">
    <div class="modal">
      <p class="modal-title">delete this note?</p>
      <p class="modal-body">this cannot be undone. the encrypted record will be permanently removed from IndexedDB.</p>
      <div class="modal-actions">
        <button onclick={() => (showDeleteConfirm = false)} class="action-btn">cancel</button>
        <button onclick={confirmDelete} class="action-btn danger">delete permanently</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .page {
    max-width: 640px;
    margin: 0 auto;
    padding: 2.5rem 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .back-link {
    font-family: var(--font-mono);
    font-size: 0.7rem;
    color: var(--muted);
    text-decoration: none;
    transition: color 0.15s;
  }
  .back-link:hover { color: var(--text); }

  .actions {
    display: flex;
    gap: 0.75rem;
  }

  .action-btn {
    font-family: var(--font-mono);
    font-size: 0.7rem;
    color: var(--muted);
    background: none;
    border: none;
    cursor: pointer;
    padding: 0;
    transition: color 0.15s;
  }
  .action-btn:hover { color: var(--text); }
  .action-btn.danger { color: #f87171; }
  .action-btn.danger:hover { color: #fca5a5; }
  .action-btn.primary {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 4px;
    padding: 0.3rem 0.75rem;
    color: var(--text);
    transition: border-color 0.15s;
  }
  .action-btn.primary:hover:not(:disabled) { border-color: var(--muted); }
  .action-btn.primary:disabled { opacity: 0.5; cursor: not-allowed; }

  .hint {
    font-family: var(--font-mono);
    font-size: 0.75rem;
    color: var(--muted);
  }

  .err-msg {
    font-family: var(--font-mono);
    font-size: 0.75rem;
    color: #f87171;
  }

  .meta {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
    font-family: var(--font-mono);
    font-size: 0.65rem;
    color: var(--muted);
    opacity: 0.8;
  }

  .note-title {
    font-family: var(--font-mono);
    font-size: 1rem;
    font-weight: 500;
    color: var(--text);
    margin: 0;
  }

  .title-input {
    width: 100%;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 4px;
    padding: 0.75rem 1rem;
    font-family: var(--font-mono);
    font-size: 0.875rem;
    color: var(--text);
    outline: none;
    transition: border-color 0.15s;
    box-sizing: border-box;
  }
  .title-input:focus { border-color: var(--muted); }
  .title-input::placeholder { color: var(--muted); }

  .note-body {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 4px;
    padding: 1rem;
    font-family: var(--font-mono);
    font-size: 0.875rem;
    color: var(--text);
    white-space: pre-wrap;
    min-height: 8rem;
    line-height: 1.6;
  }

  .editor {
    width: 100%;
    min-height: 16rem;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 4px;
    padding: 1rem;
    font-family: var(--font-mono);
    font-size: 0.875rem;
    color: var(--text);
    resize: vertical;
    outline: none;
    transition: border-color 0.15s;
    line-height: 1.6;
  }
  .editor:focus { border-color: var(--muted); }
  .editor::placeholder { color: var(--muted); }

  .edit-actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 0.75rem;
  }

  /* Delete modal */
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 50;
  }

  .modal {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 1.5rem;
    max-width: 360px;
    width: calc(100% - 2rem);
  }

  .modal-title {
    font-family: var(--font-mono);
    font-size: 0.875rem;
    color: var(--text);
    margin: 0 0 0.5rem;
  }

  .modal-body {
    font-family: var(--font-mono);
    font-size: 0.7rem;
    color: var(--muted);
    line-height: 1.5;
    margin: 0 0 1.25rem;
  }

  .modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
  }
</style>
