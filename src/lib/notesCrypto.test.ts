/**
 * notesCrypto.test.ts — Tests for encryptNoteEnvelope and decryptNoteWithVersion.
 */
import { describe, it, expect } from 'vitest';
import { generateSalt, deriveKeys, encryptNote } from './crypto.js';
import { encryptNoteEnvelope, decryptNoteWithVersion } from './notesCrypto.js';
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
  let titleIv: Uint8Array | undefined;
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
});
