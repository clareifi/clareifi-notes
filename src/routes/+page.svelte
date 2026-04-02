<!-- Notes list — the main view after vault unlock -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { session } from '$lib/stores.svelte.js';
  import { getAllNotes } from '$lib/storage.js';
  import { decryptNote } from '$lib/crypto.js';
  import type { EncryptedNote } from '$lib/types.js';

  let notesWithTitles = $state<{ note: EncryptedNote; title: string }[]>([]);
  let loading = $state(true);

  onMount(async () => {
    if (session.isUnlocked && session.masterKey) {
      const allNotes = await getAllNotes();
      notesWithTitles = await Promise.all(
        allNotes.map(async (note) => {
          let title = shortId(note.id);
          if (note.titleCiphertext && note.titleIv && session.masterKey) {
            try {
              const decrypted = await decryptNote(note.titleCiphertext, note.titleIv, session.masterKey);
              title = decrypted || shortId(note.id);
            } catch {
              // keep fallback
            }
          }
          return { note, title };
        })
      );
    }
    loading = false;
  });

  function formatDate(iso: string): string {
    return new Date(iso).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function shortId(id: string): string {
    return id.slice(0, 8);
  }
</script>

<div class="page">
  <div class="page-header">
    <h1 class="page-title">notes</h1>
    <a href="/notes/new" class="btn">+ new note</a>
  </div>

  {#if loading}
    <p class="hint">loading…</p>
  {:else if notes.length === 0}
    <div class="empty-state">
      <p class="hint">no notes yet</p>
      <a href="/notes/new" class="empty-cta">create your first note →</a>
    </div>
  {:else}
    <ul class="note-list">
      {#each notesWithTitles as { note, title } (note.id)}
        <li>
          <a href="/notes/{note.id}" class="note-row">
            <span class="note-label">{title}</span>
            <span class="note-date">{formatDate(note.updatedAt)}</span>
          </a>
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .page {
    max-width: 640px;
    margin: 0 auto;
    padding: 2.5rem 1.5rem;
  }

  .page-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 2rem;
  }

  .page-title {
    font-family: var(--font-mono);
    font-size: 1rem;
    font-weight: 500;
    color: var(--text);
    margin: 0;
  }

  .hint {
    font-family: var(--font-mono);
    font-size: 0.75rem;
    color: var(--muted);
  }

  .empty-state {
    text-align: center;
    padding: 4rem 0;
  }

  .empty-cta {
    font-family: var(--font-mono);
    font-size: 0.7rem;
    color: #4ade80;
    text-decoration: none;
    transition: color 0.15s;
  }
  .empty-cta:hover { color: #86efac; }

  .note-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .note-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 4px;
    padding: 0.75rem 1rem;
    text-decoration: none;
    transition: border-color 0.15s;
  }
  .note-row:hover { border-color: var(--muted); }

  .note-label {
    font-family: var(--font-mono);
    font-size: 0.7rem;
    color: var(--muted);
    transition: color 0.15s;
  }
  .note-row:hover .note-label { color: var(--text); }

  .note-date {
    font-family: var(--font-mono);
    font-size: 0.7rem;
    color: var(--muted);
  }

  .btn {
    font-family: var(--font-mono);
    font-size: 0.7rem;
    color: var(--text);
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 4px;
    padding: 0.375rem 0.75rem;
    text-decoration: none;
    cursor: pointer;
    transition: border-color 0.15s;
  }
  .btn:hover { border-color: var(--muted); }
</style>
