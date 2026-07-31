/**
 * crypto.test.ts — Unit tests for envelope encryption primitives.
 *
 * Tests cover generateDek, wrapDek, and unwrapDek only.
 * Existing functions (generateSalt, deriveKeys, encryptNote, decryptNote)
 * are used as test helpers but are not themselves under test here.
 */
import { describe, it, expect } from 'vitest';
import {
  generateSalt,
  deriveKeys,
  encryptNote,
  decryptNote,
  generateDek,
  wrapDek,
  unwrapDek,
} from './crypto.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Derive a KEK from a fixed password — masterKey now carries wrapKey/unwrapKey usages. */
async function makeKek(password = 'test-password'): Promise<CryptoKey> {
  const { masterKey } = await deriveKeys(password, generateSalt());
  return masterKey;
}

// ── generateDek ───────────────────────────────────────────────────────────────

describe('generateDek', () => {
  it('(a) returns an AES-GCM 256-bit CryptoKey with correct usages', async () => {
    const dek = await generateDek();

    expect(dek.type).toBe('secret');
    expect(dek.algorithm.name).toBe('AES-GCM');
    expect((dek.algorithm as AesKeyAlgorithm).length).toBe(256);
    expect(dek.usages).toContain('encrypt');
    expect(dek.usages).toContain('decrypt');
  });

  it('(a) DEK is extractable (required for wrapKey)', async () => {
    const dek = await generateDek();
    expect(dek.extractable).toBe(true);
  });
});

// ── wrapDek + unwrapDek ───────────────────────────────────────────────────────

describe('wrapDek / unwrapDek', () => {
  it('(b) round-trip: unwrapped DEK can encrypt and decrypt note content', async () => {
    const kek = await makeKek();
    const dek = await generateDek();

    const { wrappedDek, wrapIv } = await wrapDek(dek, kek);
    const unwrapped = await unwrapDek(wrappedDek, wrapIv, kek);

    const plaintext = 'envelope round-trip test';
    const { iv, ciphertext } = await encryptNote(plaintext, dek);
    const decrypted = await decryptNote(ciphertext, iv, unwrapped);

    expect(decrypted).toBe(plaintext);
  });

  it('(c) unwrapDek with a wrong KEK throws', async () => {
    const kek = await makeKek('correct-password');
    const wrongKek = await makeKek('wrong-password');
    const dek = await generateDek();

    const { wrappedDek, wrapIv } = await wrapDek(dek, kek);

    await expect(unwrapDek(wrappedDek, wrapIv, wrongKek)).rejects.toThrow();
  });

  it('(d) unwrapDek with a tampered wrappedDek throws', async () => {
    const kek = await makeKek();
    const dek = await generateDek();

    const { wrappedDek, wrapIv } = await wrapDek(dek, kek);

    // Flip the first byte to corrupt the authenticated ciphertext
    const tampered = wrappedDek.slice(0);
    new Uint8Array(tampered)[0] ^= 0xff;

    await expect(unwrapDek(tampered, wrapIv, kek)).rejects.toThrow();
  });

  it('(e) unwrapDek with a wrong IV throws', async () => {
    const kek = await makeKek();
    const dek = await generateDek();

    const { wrappedDek } = await wrapDek(dek, kek);
    const wrongIv = crypto.getRandomValues(new Uint8Array(12));

    await expect(unwrapDek(wrappedDek, wrongIv, kek)).rejects.toThrow();
  });

  it('(f) two wrapDek calls with the same DEK+KEK produce different output (IV randomness)', async () => {
    const kek = await makeKek();
    const dek = await generateDek();

    const first = await wrapDek(dek, kek);
    const second = await wrapDek(dek, kek);

    // IVs must differ
    expect(first.wrapIv).not.toEqual(second.wrapIv);

    // Wrapped bytes must differ (different IVs → different GCM output)
    const a = new Uint8Array(first.wrappedDek);
    const b = new Uint8Array(second.wrappedDek);
    expect(a).not.toEqual(b);
  });

  it('(g) CryptoKey returned by unwrapDek is non-extractable', async () => {
    const kek = await makeKek();
    const dek = await generateDek();

    const { wrappedDek, wrapIv } = await wrapDek(dek, kek);
    const unwrapped = await unwrapDek(wrappedDek, wrapIv, kek);

    expect(unwrapped.extractable).toBe(false);
  });
});
