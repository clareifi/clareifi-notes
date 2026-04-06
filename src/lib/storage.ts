/**
 * storage.ts — IndexedDB operations via idb-keyval.
 *
 * idb-keyval uses the structured clone algorithm, so Uint8Array and
 * ArrayBuffer values are stored natively — no serialisation needed.
 *
 * Key schema:
 *   'vault_config'    → VaultConfig object
 *   'note:<uuid>'     → EncryptedNote object
 */
import { get, set, del, keys } from 'idb-keyval';
import type { EncryptedNote, VaultConfig } from './types.js';
import { supabase } from './supabase.js';

/** Encode binary data as a base64 string for JSON transport to Supabase. */
function toBase64(bytes: Uint8Array | ArrayBuffer): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = '';
  for (let i = 0; i < arr.length; i++) binary += String.fromCharCode(arr[i]);
  return btoa(binary);
}

/** Decode a base64 string back to a Uint8Array. */
function fromBase64(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

const VAULT_CONFIG_KEY = 'vault_config';
const NOTE_PREFIX = 'note:';

// ── Vault config ──────────────────────────────────────────────────────────────

export async function getVaultConfig(): Promise<VaultConfig | undefined> {
  return get<VaultConfig>(VAULT_CONFIG_KEY);
}

export async function saveVaultConfig(config: VaultConfig): Promise<void> {
  await set(VAULT_CONFIG_KEY, config);
}

export async function vaultExists(): Promise<boolean> {
  const config = await getVaultConfig();
  return config !== undefined;
}

// ── Notes ─────────────────────────────────────────────────────────────────────

export async function saveNote(note: EncryptedNote): Promise<void> {
  await set(`${NOTE_PREFIX}${note.id}`, note);

  // Sync to Supabase after local write succeeds — failures are non-blocking
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { error } = await supabase.from('notes').upsert({
        id: note.id,
        user_id: user.id,
        ciphertext: toBase64(note.ciphertext),
        iv: toBase64(note.iv),
        title_ciphertext: note.titleCiphertext ? toBase64(note.titleCiphertext) : null,
        title_iv: note.titleIv ? toBase64(note.titleIv) : null,
        created_at: note.createdAt,
        updated_at: note.updatedAt,
      });
      if (error) console.error('[storage] saveNote sync failed:', error.message);
    }
  } catch (err) {
    console.error('[storage] saveNote sync failed:', err);
  }
}

export async function getNote(id: string): Promise<EncryptedNote | undefined> {
  return get<EncryptedNote>(`${NOTE_PREFIX}${id}`);
}

export async function getAllNotes(): Promise<EncryptedNote[]> {
  const allKeys = await keys();
  const noteKeys = allKeys.filter(
    (k): k is string =>
      typeof k === 'string' && k.startsWith(NOTE_PREFIX)
  );
  const notes = await Promise.all(noteKeys.map((k) => get<EncryptedNote>(k)));
  return (notes.filter(Boolean) as EncryptedNote[]).sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

export async function pullNotesFromSupabase(): Promise<number> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return 0;

  const { data: rows, error } = await supabase
    .from('notes')
    .select('id, ciphertext, iv, title_ciphertext, title_iv, created_at, updated_at')
    .eq('user_id', user.id);

  if (error) { console.error('[storage] pullNotesFromSupabase failed:', error.message); return 0; }
  if (!rows || rows.length === 0) return 0;

  let written = 0;
  for (const row of rows) {
    const localNote = await get(`note:${row.id}`);
    if (localNote) {
      if (new Date(localNote.updatedAt).getTime() >= new Date(row.updated_at).getTime()) continue;
    }
    await set(`note:${row.id}`, {
      id: row.id,
      iv: (() => { const b = atob(row.iv); const a = new Uint8Array(b.length); for(let i=0;i<b.length;i++) a[i]=b.charCodeAt(i); return a; })(),
      ciphertext: (() => { const b = atob(row.ciphertext); const a = new Uint8Array(b.length); for(let i=0;i<b.length;i++) a[i]=b.charCodeAt(i); return a.buffer; })(),
      titleIv: row.title_iv ? (() => { const b = atob(row.title_iv); const a = new Uint8Array(b.length); for(let i=0;i<b.length;i++) a[i]=b.charCodeAt(i); return a; })() : undefined,
      titleCiphertext: row.title_ciphertext ? (() => { const b = atob(row.title_ciphertext); const a = new Uint8Array(b.length); for(let i=0;i<b.length;i++) a[i]=b.charCodeAt(i); return a.buffer; })() : undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
    written++;
  }
  return written;
}

export async function deleteNote(id: string): Promise<void> {
  await del(`${NOTE_PREFIX}${id}`);

  // Sync to Supabase after local delete succeeds — failures are non-blocking
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { error } = await supabase.from('notes').delete().eq('id', id);
      if (error) console.error('[storage] deleteNote sync failed:', error.message);
    }
  } catch (err) {
    console.error('[storage] deleteNote sync failed:', err);
  }
}
