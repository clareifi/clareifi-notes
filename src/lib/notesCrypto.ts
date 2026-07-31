/**
 * notesCrypto.ts — Orchestration layer for note encryption/decryption.
 *
 * Sits between the raw crypto primitives (crypto.ts) and the storage
 * layer (storage.ts). Callers pass a KEK (the PBKDF2-derived masterKey)
 * and receive or supply fully-opaque EncryptedNote shapes.
 *
 * Security invariants:
 * - DEKs are generated fresh for every new note and go out of scope
 *   after this module returns — they are never exported to callers.
 * - No plaintext, raw key bytes, or intermediate key material is logged
 *   or exposed outside this module.
 * - encryptNoteEnvelope always produces version: 2 output.
 * - decryptNoteWithVersion branches on note.version, treating undefined
 *   as version 1 (legacy direct-master-key path).
 */

import { encryptNote, decryptNote, generateDek, wrapDek, unwrapDek } from './crypto.js';
import type { EncryptedNote } from './types.js';

// ── Encrypt ───────────────────────────────────────────────────────────────────

/**
 * Encrypt note content (and optional title) using envelope encryption.
 *
 * A single fresh DEK is generated per call. Both content and title are
 * encrypted with the same DEK using distinct random IVs — one DEK per
 * note is deliberate (it matches the approved design and avoids DEK
 * proliferation). The DEK is then wrapped under the caller's KEK.
 *
 * Empty string title is treated as absent: no titleCiphertext is produced.
 *
 * Always returns version: 2. Never writes v1.
 */
export async function encryptNoteEnvelope(
  content: string,
  title: string | undefined,
  kek: CryptoKey
): Promise<{
  version: 2;
  ciphertext: ArrayBuffer;
  iv: Uint8Array;
  titleCiphertext?: ArrayBuffer;
  titleIv?: Uint8Array;
  wrappedDek: ArrayBuffer;
  wrapIv: Uint8Array;
}> {
  const dek = await generateDek();

  // Encrypt content with a fresh IV
  const { ciphertext, iv } = await encryptNote(content, dek);

  // Encrypt title with a separate fresh IV — only if defined and non-empty.
  // Empty string is treated identically to undefined (no title stored).
  let titleCiphertext: ArrayBuffer | undefined;
  let titleIv: Uint8Array | undefined;
  if (title !== undefined && title !== '') {
    const encrypted = await encryptNote(title, dek);
    titleCiphertext = encrypted.ciphertext;
    titleIv = encrypted.iv;
  }

  // Wrap the DEK under the KEK — after this, the raw DEK bytes are
  // inaccessible; only the wrapped form is returned to the caller.
  const { wrappedDek, wrapIv } = await wrapDek(dek, kek);

  return { version: 2, ciphertext, iv, titleCiphertext, titleIv, wrappedDek, wrapIv };
}

// ── Decrypt ───────────────────────────────────────────────────────────────────

/**
 * Decrypt a note of any supported version.
 *
 * v1 (version === 1 or version === undefined):
 *   Content and title are decrypted directly with the KEK (masterKey).
 *   This matches the original single-key encryption scheme.
 *
 * v2 (version === 2):
 *   The DEK is unwrapped from note.wrappedDek using the KEK, then used
 *   to decrypt content and title.
 *
 * Returns { content, title } where title is undefined if no encrypted
 * title fields are present on the note.
 */
export async function decryptNoteWithVersion(
  note: EncryptedNote,
  kek: CryptoKey
): Promise<{ content: string; title: string | undefined }> {
  const version = note.version ?? 1;

  if (version === 1) {
    const content = await decryptNote(note.ciphertext, note.iv, kek);
    let title: string | undefined;
    if (note.titleCiphertext && note.titleIv) {
      title = await decryptNote(note.titleCiphertext, note.titleIv, kek);
    }
    return { content, title };
  }

  // v2 — envelope path
  if (!note.wrappedDek || !note.wrapIv) {
    throw new Error('missing wrappedDek or wrapIv for v2 note');
  }

  let dek: CryptoKey;
  try {
    dek = await unwrapDek(
      note.wrappedDek,
      note.wrapIv as Uint8Array<ArrayBuffer>,
      kek
    );
  } catch {
    throw new Error('unwrap failed — wrong key or corrupted wrapped DEK');
  }

  const content = await decryptNote(note.ciphertext, note.iv, dek);
  let title: string | undefined;
  if (note.titleCiphertext && note.titleIv) {
    title = await decryptNote(note.titleCiphertext, note.titleIv, dek);
  }
  return { content, title };
}
