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
