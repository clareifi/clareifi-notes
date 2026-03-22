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
}
