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
import { generateDek, wrapDek, unwrapDek } from './crypto.js';
import { supabase } from './supabase.js';

/** Encode binary data as a base64 string for JSON transport to Supabase. */
export function toBase64(bytes: Uint8Array | ArrayBuffer): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = '';
  for (let i = 0; i < arr.length; i++) binary += String.fromCharCode(arr[i]);
  return btoa(binary);
}

/** Decode a base64 string back to a Uint8Array backed by a standard ArrayBuffer. */
export function fromBase64(b64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(b64);
  const buffer = new ArrayBuffer(binary.length);
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

const VAULT_CONFIG_KEY = 'vault_config';
const NOTE_PREFIX = 'note:';

// ── Vault config & Phase 3 Envelope Migration ────────────────────────────────

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

/**
 * Sync vault_config to Supabase with Phase 3 envelope fields (wrapped_dek, dek_iv),
 * falling back gracefully to Phase 2 columns if the remote table schema has not yet
 * been migrated.
 */
export async function syncVaultConfigToSupabase(
  userId: string,
  config: VaultConfig
): Promise<void> {
  try {
    if (config.wrappedDek && config.dekIv) {
      const { error } = await supabase.from('vault_config').upsert(
        {
          user_id: userId,
          salt: toBase64(config.salt),
          auth_hash: config.authHash,
          wrapped_dek: toBase64(config.wrappedDek),
          dek_iv: toBase64(config.dekIv),
        },
        { onConflict: 'user_id' }
      );
      if (!error) return;
    }

    // Fallback to Phase 2 column set if Phase 3 columns are not yet provisioned remotely
    const { error: fallbackError } = await supabase.from('vault_config').upsert(
      {
        user_id: userId,
        salt: toBase64(config.salt),
        auth_hash: config.authHash,
      },
      { onConflict: 'user_id' }
    );
    if (fallbackError) {
      console.error('[storage] vault_config upsert failed:', fallbackError.message);
    }
  } catch (err) {
    console.error('[storage] vault_config sync error:', err);
  }
}

/**
 * Ensure a vault config has a Phase 3 Envelope DEK wrapped under the user's KEK.
 * If the vault was created under Phase 2 (no wrappedDek), seamlessly generates
 * and wraps a new random AES-GCM 256-bit DEK and persists the upgraded VaultConfig.
 */
export async function ensureVaultEnvelope(
  config: VaultConfig,
  kek: CryptoKey
): Promise<{ config: VaultConfig; dek: CryptoKey; upgraded: boolean }> {
  if (config.wrappedDek && config.dekIv) {
    const dek = await unwrapDek(config.wrappedDek, config.dekIv, kek);
    return { config, dek, upgraded: false };
  }

  // Seamless Phase 2 -> Phase 3 upgrade
  const extractableDek = await generateDek();
  const { wrappedDek, wrapIv: dekIv } = await wrapDek(extractableDek, kek);
  const dek = await unwrapDek(wrappedDek, dekIv, kek);

  const upgradedConfig: VaultConfig = {
    ...config,
    version: 2,
    wrappedDek,
    dekIv,
    updatedAt: new Date().toISOString(),
  };

  await saveVaultConfig(upgradedConfig);
  return { config: upgradedConfig, dek, upgraded: true };
}

// ── Notes ─────────────────────────────────────────────────────────────────────

export async function saveNote(note: EncryptedNote): Promise<void> {
  await set(`${NOTE_PREFIX}${note.id}`, note);

  // Sync to Supabase after local write succeeds — failures are non-blocking
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const basePayload = {
        id: note.id,
        user_id: user.id,
        ciphertext: toBase64(note.ciphertext),
        iv: toBase64(note.iv),
        title_ciphertext: note.titleCiphertext ? toBase64(note.titleCiphertext) : null,
        title_iv: note.titleIv ? toBase64(note.titleIv) : null,
        created_at: note.createdAt,
        updated_at: note.updatedAt,
      };

      const { error } = await supabase.from('notes').upsert(basePayload);
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

  if (error) {
    console.error('[storage] pullNotesFromSupabase failed:', error.message);
    return 0;
  }
  if (!rows || rows.length === 0) return 0;

  let written = 0;
  for (const row of rows) {
    // Local is always primary — skip if local copy is same age or newer
    const existing = await get<EncryptedNote>(`${NOTE_PREFIX}${row.id}`);
    if (existing && new Date(existing.updatedAt).getTime() >= new Date(row.updated_at).getTime()) {
      continue;
    }

    const ciphertextBytes = fromBase64(row.ciphertext);
    const titleCiphertextBytes = row.title_ciphertext ? fromBase64(row.title_ciphertext) : undefined;

    // Write directly to IndexedDB — do NOT call saveNote() here because
    // that re-upserts to Supabase, which fires the updated_at trigger
    // and resets every pulled note's timestamp to now().
    const pulledNote: EncryptedNote = {
      id: row.id,
      iv: fromBase64(row.iv),
      ciphertext: ciphertextBytes.buffer,
      titleIv: row.title_iv ? fromBase64(row.title_iv) : undefined,
      titleCiphertext: titleCiphertextBytes ? titleCiphertextBytes.buffer : undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
    await set(`${NOTE_PREFIX}${row.id}`, pulledNote);
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
