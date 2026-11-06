/**
 * notesCrypto.test.ts — Tests for encryptNoteEnvelope and decryptNoteWithVersion.
 */
import { describe, it, expect, vi } from 'vitest';
import { generateSalt, deriveKeys, encryptNote, generateDek, unwrapDek, wrapDek } from './crypto.js';
import {
  encryptNoteEnvelope,
  decryptNoteWithVersion,
  decryptNoteTitleOnly,
  setNoteUpgradePersister,
} from './notesCrypto.js';
import type { EncryptedNote } from './types.js';

async function makeKek(): Promise<CryptoKey> {
  const { masterKey } = await deriveKeys('test-password', generateSalt());
  return masterKey;
}

// ── Helpers to build a minimal EncryptedNote for v1 tests ────────────────────

async function makeV1Note(
  content: string,
  title: string | undefined,
  kek: CryptoKey,
  version?: 1
): Promise<EncryptedNote> {
  const { iv, ciphertext } = await encryptNote(content, kek);
  let titleIv: Uint8Array<ArrayBuffer> | undefined;
  let titleCiphertext: ArrayBuffer | undefined;
  if (title !== undefined) {
    const enc = await encryptNote(title, kek);
    titleIv = enc.iv;
    titleCiphertext = enc.ciphertext;
  }
  return {
    id: crypto.randomUUID(),
    version,
    iv,
    ciphertext,
    titleIv,
    titleCiphertext,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

// ── encryptNoteEnvelope + decryptNoteWithVersion ──────────────────────────────

describe('encryptNoteEnvelope + decryptNoteWithVersion', () => {
  it('(a) round-trip: content and title both decrypt correctly', async () => {
    const kek = await makeKek();
    const enc = await encryptNoteEnvelope('hello world', 'greeting', kek);
    const note: EncryptedNote = {
      id: crypto.randomUUID(),
      ...enc,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const { content, title } = await decryptNoteWithVersion(note, kek);
    expect(content).toBe('hello world');
    expect(title).toBe('greeting');
  });

  it('(b) title undefined — titleCiphertext/titleIv absent, decrypt returns title: undefined', async () => {
    const kek = await makeKek();
    const enc = await encryptNoteEnvelope('only content', undefined, kek);

    expect(enc.titleCiphertext).toBeUndefined();
    expect(enc.titleIv).toBeUndefined();

    const note: EncryptedNote = {
      id: crypto.randomUUID(),
      ...enc,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const { content, title } = await decryptNoteWithVersion(note, kek);
    expect(content).toBe('only content');
    expect(title).toBeUndefined();
  });

  it('(c) empty string title is treated as absent (same as undefined)', async () => {
    const kek = await makeKek();
    // Empty string → no title encrypted
    const enc = await encryptNoteEnvelope('body text', '', kek);

    expect(enc.titleCiphertext).toBeUndefined();
    expect(enc.titleIv).toBeUndefined();

    const note: EncryptedNote = {
      id: crypto.randomUUID(),
      ...enc,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const { title } = await decryptNoteWithVersion(note, kek);
    expect(title).toBeUndefined();
  });

  it('(d) two calls with same inputs produce different ciphertext, wrappedDek, and IVs', async () => {
    const kek = await makeKek();
    const a = await encryptNoteEnvelope('same content', 'same title', kek);
    const b = await encryptNoteEnvelope('same content', 'same title', kek);

    // IVs must differ (fresh random each call)
    expect(a.iv).not.toEqual(b.iv);
    expect(a.titleIv).not.toEqual(b.titleIv);
    expect(a.wrapIv).not.toEqual(b.wrapIv);

    // Ciphertexts must differ (different IVs → different GCM output)
    expect(new Uint8Array(a.ciphertext)).not.toEqual(new Uint8Array(b.ciphertext));
    expect(new Uint8Array(a.titleCiphertext!)).not.toEqual(new Uint8Array(b.titleCiphertext!));
    expect(new Uint8Array(a.wrappedDek)).not.toEqual(new Uint8Array(b.wrappedDek));
  });

  it('(e) v1 note (version: 1) decrypts correctly via legacy path', async () => {
    const kek = await makeKek();
    const note = await makeV1Note('v1 content', 'v1 title', kek, 1);

    const { content, title } = await decryptNoteWithVersion(note, kek);
    expect(content).toBe('v1 content');
    expect(title).toBe('v1 title');
  });

  it('(f) note with version: undefined is handled identically to version: 1', async () => {
    const kek = await makeKek();
    // makeV1Note with no version argument → version field is undefined
    const note = await makeV1Note('legacy content', 'legacy title', kek);

    expect(note.version).toBeUndefined();
    const { content, title } = await decryptNoteWithVersion(note, kek);
    expect(content).toBe('legacy content');
    expect(title).toBe('legacy title');
  });

  it('(g) v2 note with wrong KEK throws', async () => {
    const kek = await makeKek();
    const wrongKek = await makeKek(); // different salt → different key
    const enc = await encryptNoteEnvelope('secret', 'title', kek);
    const note: EncryptedNote = {
      id: crypto.randomUUID(),
      ...enc,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await expect(decryptNoteWithVersion(note, wrongKek)).rejects.toThrow();
  });

  it('(h) v2 note missing wrappedDek throws a clear error', async () => {
    const kek = await makeKek();
    const enc = await encryptNoteEnvelope('content', 'title', kek);
    // Strip the envelope fields to simulate a corrupt/missing record
    const note: EncryptedNote = {
      id: crypto.randomUUID(),
      version: 2,
      iv: enc.iv,
      ciphertext: enc.ciphertext,
      // wrappedDek and wrapIv deliberately omitted
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await expect(decryptNoteWithVersion(note, kek)).rejects.toThrow(
      'missing wrappedDek or wrapIv for v2 note'
    );
  });

  it('(i) content IV and title IV in a v2 note are distinct', async () => {
    const kek = await makeKek();
    const enc = await encryptNoteEnvelope('content', 'title', kek);

    expect(enc.iv).toBeDefined();
    expect(enc.titleIv).toBeDefined();
    // Not the same reference
    expect(enc.iv).not.toBe(enc.titleIv);
    // Not the same bytes
    expect(enc.iv).not.toEqual(enc.titleIv);
  });

  it('(j) falls back to KEK when DEK fails, and transparently upgrades note to DEK in background', async () => {
    const kek = await makeKek();
    const rawDek = await generateDek();
    const { wrappedDek, wrapIv } = await wrapDek(rawDek, kek);
    const dek = await unwrapDek(wrappedDek, wrapIv, kek);

    const persistedNotes: EncryptedNote[] = [];
    setNoteUpgradePersister(async (n) => {
      persistedNotes.push(n);
    });

    // Legacy Phase 2 note encrypted directly with KEK
    const legacyNote = await makeV1Note('legacy body', 'legacy title', kek, 1);
    legacyNote.createdAt = '2025-07-30T10:00:00.000Z';
    legacyNote.updatedAt = '2025-08-08T12:00:00.000Z';

    const { content, title } = await decryptNoteWithVersion(legacyNote, dek, kek);
    expect(content).toBe('legacy body');
    expect(title).toBe('legacy title');

    // Wait briefly for fire-and-forget background upgrade
    await vi.waitFor(() => {
      expect(persistedNotes.length).toBe(1);
    });

    const upgradedNote = persistedNotes[0];
    expect(upgradedNote.createdAt).toBe('2025-07-30T10:00:00.000Z');
    expect(upgradedNote.updatedAt).toBe('2025-08-08T12:00:00.000Z');
    // Upgraded note must now decrypt directly with DEK (without needing fallback KEK)
    const afterUpgrade = await decryptNoteWithVersion(upgradedNote, dek);
    expect(afterUpgrade.content).toBe('legacy body');
    expect(afterUpgrade.title).toBe('legacy title');

    setNoteUpgradePersister(null);
  });

  it('(k) decryptNoteTitleOnly falls back to KEK when DEK fails', async () => {
    const kek = await makeKek();
    const rawDek = await generateDek();
    const { wrappedDek, wrapIv } = await wrapDek(rawDek, kek);
    const dek = await unwrapDek(wrappedDek, wrapIv, kek);

    const persistedNotes: EncryptedNote[] = [];
    setNoteUpgradePersister(async (n) => {
      persistedNotes.push(n);
    });

    const legacyNote = await makeV1Note('legacy body', 'sidebar title', kek, 1);
    const title = await decryptNoteTitleOnly(legacyNote, dek, kek);
    expect(title).toBe('sidebar title');

    await vi.waitFor(() => {
      expect(persistedNotes.length).toBe(1);
    });
    setNoteUpgradePersister(null);
  });

  it('(l) throws "Unable to decrypt note" when both DEK and fallback KEK fail', async () => {
    const realKey = await makeKek();
    const wrongDek = await makeKek();
    const wrongKek = await makeKek();

    const note = await makeV1Note('secret content', 'secret title', realKey, 1);

    await expect(decryptNoteWithVersion(note, wrongDek, wrongKek)).rejects.toThrow(
      'Unable to decrypt note'
    );
    await expect(decryptNoteTitleOnly(note, wrongDek, wrongKek)).rejects.toThrow(
      'Unable to decrypt note'
    );
  });
});
