<!-- Create new note -->
<script lang="ts">
  import { goto } from '$app/navigation';
  import { session } from '$lib/stores.svelte.js';
  import { encryptNote } from '$lib/crypto.js';
  import { saveNote } from '$lib/storage.js';

  let content = $state('');
  let saving = $state(false);
  let error = $state('');

  async function save() {
    if (!content.trim()) return;
    if (!session.masterKey) {
      goto('/unlock');
      return;
    }

    saving = true;
    error = '';

    try {
      const { iv, ciphertext } = await encryptNote(content, session.masterKey);
      const now = new Date().toISOString();
      const note = {
        id: crypto.randomUUID(),
        iv,
        ciphertext,
        createdAt: now,
        updatedAt: now,
      };

      await saveNote(note);
      goto(`/notes/${note.id}`);
    } catch (err) {
      console.error(err);
      error = 'failed to save note — please try again';
      saving = false;
    }
  }
</script>

<div class="page">
  <div class="toolbar">
    <a href="/" class="back-link">← all notes</a>
    <span class="label">new note</span>
  </div>

  <textarea
    bind:value={content}
    placeholder="start writing…"
    autofocus
    class="editor"
  ></textarea>

  {#if error}
    <p class="error">{error}</p>
  {/if}

  <div class="footer">
    <span class="char-count">{content.length} chars</span>
    <button onclick={save} disabled={saving || !content.trim()} class="btn-save">
      {saving ? 'encrypting…' : 'encrypt & save'}
    </button>
  </div>
</div>

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

  .label {
    font-family: var(--font-mono);
    font-size: 0.7rem;
    color: var(--muted);
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

  .error {
    font-family: var(--font-mono);
    font-size: 0.7rem;
    color: #f87171;
    margin: 0;
  }

  .footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .char-count {
    font-family: var(--font-mono);
    font-size: 0.65rem;
    color: var(--muted);
    opacity: 0.7;
  }

  .btn-save {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 4px;
    padding: 0.375rem 0.875rem;
    font-family: var(--font-mono);
    font-size: 0.7rem;
    color: var(--text);
    cursor: pointer;
    transition: border-color 0.15s;
  }
  .btn-save:hover:not(:disabled) { border-color: var(--muted); }
  .btn-save:disabled { opacity: 0.5; cursor: not-allowed; }
</style>
