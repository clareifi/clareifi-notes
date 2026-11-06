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
 * Fetch the remote vault_config row from Supabase, querying Phase 3 envelope
 * columns (wrapped_dek, dek_iv, salt, auth_hash) first and falling back
 * gracefully to Phase 2 columns (salt, auth_hash) if the remote table schema
 * has not yet been migrated.
 */
export async function fetchRemoteVaultConfig(userId?: string): Promise<{
  salt: string;
  auth_hash: string;
  wrapped_dek?: string | null;
  dek_iv?: string | null;
} | null> {
  try {
    let resolvedUserId = userId;
    if (!resolvedUserId) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      resolvedUserId = user?.id;
    }

    let query = supabase
      .from('vault_config')
      .select('wrapped_dek, dek_iv, salt, auth_hash');
    if (resolvedUserId) {
      query = query.eq('user_id', resolvedUserId);
    }
    const { data, error } = await query.single();

    if (!error && data) return data;

    // Fallback to Phase 2 column selection if remote table hasn't added wrapped_dek / dek_iv yet
    let legacyQuery = supabase.from('vault_config').select('salt, auth_hash');
    if (resolvedUserId) {
      legacyQuery = legacyQuery.eq('user_id', resolvedUserId);
    }
    const { data: legacyData, error: legacyErr } = await legacyQuery.single();

    if (legacyErr || !legacyData) return null;
    return legacyData;
  } catch (err) {
    console.warn('[storage] fetchRemoteVaultConfig failed:', err);
    return null;
  }
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
 * Ensure a vault config has a Phase 3 Envelope DEK wrapped under the user's KEK,
 * enforcing centralized remote DEK synchronization across all devices:
 *
 * 1. Always queries `supabase.from('vault_config').select('wrapped_dek, dek_iv, salt, auth_hash')` first.
 * 2. Case A (Remote Envelope Exists): If `wrapped_dek` and `dek_iv` exist in Supabase,
 *    unwraps that specific DEK using the derived KEK (never generates a diverging DEK)
 *    and saves the synchronized config into local IndexedDB.
 * 3. Case B (Remote Envelope Missing): Only generates a fresh DEK if neither local
 *    IndexedDB nor remote Supabase has `wrapped_dek`, then immediately wraps and
 *    persists it both locally and to Supabase.
 */
export async function ensureVaultEnvelope(
  config: VaultConfig,
  kek: CryptoKey,
  userId?: string
): Promise<{ config: VaultConfig; dek: CryptoKey; upgraded: boolean }> {
  let resolvedUserId = userId;
  if (!resolvedUserId) {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      resolvedUserId = user?.id;
    } catch {
      // Offline or unauthenticated — proceed with local fallback if needed
    }
  }

  // Always check remote vault_config first to prevent multi-device DEK divergence
  const remoteConfig = await fetchRemoteVaultConfig(resolvedUserId);

  // Case A (Remote Envelope Exists): unwrap remote DEK and persist to local IndexedDB
  if (remoteConfig?.wrapped_dek && remoteConfig?.dek_iv) {
    const remoteWrappedDek = fromBase64(remoteConfig.wrapped_dek).buffer;
    const remoteDekIv = fromBase64(remoteConfig.dek_iv);
    const dek = await unwrapDek(remoteWrappedDek, remoteDekIv, kek);

    const syncedConfig: VaultConfig = {
      ...config,
      version: 2,
      salt: remoteConfig.salt ? fromBase64(remoteConfig.salt) : config.salt,
      authHash: remoteConfig.auth_hash || config.authHash,
      wrappedDek: remoteWrappedDek,
      dekIv: remoteDekIv,
      updatedAt: config.updatedAt ?? new Date().toISOString(),
    };

    await saveVaultConfig(syncedConfig);
    return { config: syncedConfig, dek, upgraded: false };
  }

  // Remote envelope is missing, but local IndexedDB already has a wrapped DEK:
  // unwrap the local DEK and sync it up to Supabase so secondary devices share it.
  if (config.wrappedDek && config.dekIv) {
    const dek = await unwrapDek(config.wrappedDek, config.dekIv, kek);
    const syncedLocalConfig: VaultConfig = {
      ...config,
      version: 2,
    };
    await saveVaultConfig(syncedLocalConfig);
    if (resolvedUserId) {
      await syncVaultConfigToSupabase(resolvedUserId, syncedLocalConfig);
    }
    return { config: syncedLocalConfig, dek, upgraded: false };
  }

  // Case B (Remote Envelope Missing & Local Envelope Missing):
  // Generate a fresh DEK, wrap it under KEK, and persist both locally and to Supabase.
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
  if (resolvedUserId) {
    await syncVaultConfigToSupabase(resolvedUserId, upgradedConfig);
  }
  return { config: upgradedConfig, dek, upgraded: true };
}

// ── Notes ─────────────────────────────────────────────────────────────────────

export async function saveNote(note: EncryptedNote): Promise<void> {
  const existing = await get<EncryptedNote>(`${NOTE_PREFIX}${note.id}`);
  const createdAt = existing?.createdAt || (note.createdAt ? note.createdAt : new Date().toISOString());
  const noteToSave: EncryptedNote = {
    ...note,
    createdAt,
  };

  await set(`${NOTE_PREFIX}${noteToSave.id}`, noteToSave);

  // Sync to Supabase after local write succeeds — failures are non-blocking
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const basePayload = {
        id: noteToSave.id,
        user_id: user.id,
        ciphertext: toBase64(noteToSave.ciphertext),
        iv: toBase64(noteToSave.iv),
        title_ciphertext: noteToSave.titleCiphertext ? toBase64(noteToSave.titleCiphertext) : null,
        title_iv: noteToSave.titleIv ? toBase64(noteToSave.titleIv) : null,
        created_at: noteToSave.createdAt,
        updated_at: noteToSave.updatedAt,
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
      createdAt: existing?.createdAt || row.created_at,
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
