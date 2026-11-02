/**
 * crypto.ts — All cryptographic operations for Clareifi Notes.
 *
 * Security rules enforced here:
 * - No plaintext ever leaves this module unencrypted
 * - Master key is non-extractable; it never leaves memory
 * - Every encrypt call gets a fresh random IV
 * - All operations use window.crypto.subtle (Web Crypto API) exclusively
 */

/**
 * Generate a random 16-byte salt for PBKDF2 key derivation.
 */
export function generateSalt(): Uint8Array<ArrayBuffer> {
  return crypto.getRandomValues(new Uint8Array(16));
}

/**
 * Derive a master key / KEK (for AES-GCM encryption and DEK wrapping) and an auth hash
 * (for local password verification) from the user's password and salt.
 *
 * Two separate PBKDF2 derivations are performed:
 *   1. masterKey (KEK) — non-extractable CryptoKey for AES-GCM & key wrapping
 *   2. authHash        — hex string used only to verify login locally
 *
 * The auth hash uses a modified salt (original salt + 0xFF byte) so
 * the two derivations are cryptographically independent.
 */
export async function deriveKeys(
  password: string,
  salt: Uint8Array<ArrayBuffer>
): Promise<{ masterKey: CryptoKey; authHash: string }> {
  const enc = new TextEncoder();
  const safeSalt = new Uint8Array(salt);

  // Import the password as raw key material for PBKDF2
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveKey', 'deriveBits']
  );

  // Derive the master key (non-extractable AES-GCM 256-bit).
  // wrapKey/unwrapKey usages are included so this key also serves as the
  // KEK for envelope encryption — no second PBKDF2 derivation needed.
  const masterKey = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: safeSalt, iterations: 310_000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,       // non-extractable — the key can never be exported
    ['encrypt', 'decrypt', 'wrapKey', 'unwrapKey']
  );

  // Derive the auth hash using a salt variant (salt || 0xFF)
  // This keeps the auth hash cryptographically separate from the master key
  const authSalt = new Uint8Array([...safeSalt, 0xff]);
  const authBits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: authSalt, iterations: 310_000, hash: 'SHA-256' },
    keyMaterial,
    256
  );
  const authHash = Array.from(new Uint8Array(authBits))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return { masterKey, authHash };
}

/**
 * Encrypt a plaintext string using AES-GCM.
 * A fresh random 12-byte IV is generated for every call — never reused.
 */
export async function encryptNote(
  content: string,
  masterKey: CryptoKey
): Promise<{ iv: Uint8Array<ArrayBuffer>; ciphertext: ArrayBuffer }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(content);
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    masterKey,
    encoded
  );
  return { iv, ciphertext };
}

/**
 * Decrypt an AES-GCM ciphertext back to a plaintext string.
 * Throws if the key is wrong or the ciphertext has been tampered with
 * (AES-GCM provides authenticated encryption).
 */
export async function decryptNote(
  ciphertext: ArrayBuffer,
  iv: Uint8Array<ArrayBuffer>,
  masterKey: CryptoKey
): Promise<string> {
  const safeIv = new Uint8Array(iv);
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: safeIv },
    masterKey,
    ciphertext
  );
  return new TextDecoder().decode(plaintext);
}

// ── Envelope encryption primitives ───────────────────────────────────────────
//
// These functions implement the DEK (Data Encryption Key) layer.
// Both vault-level DEKs (stored in vault_config as wrapped_dek / dek_iv) and
// per-note DEKs are wrapped (encrypted) under a KEK (Key Encryption Key —
// the PBKDF2-derived master key). Re-keying / password rotation only
// re-wraps the DEK without re-encrypting note ciphertexts.

/**
 * Generate a fresh random AES-GCM 256-bit Data Encryption Key (DEK).
 *
 * extractable: true is required so wrapKey can export the raw bytes
 * internally for wrapping. The DEK becomes non-extractable after unwrapKey
 * (see unwrapDek). Raw key bytes never surface in application code.
 */
export async function generateDek(): Promise<CryptoKey> {
  return crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,                          // extractable — required for wrapKey
    ['encrypt', 'decrypt', 'wrapKey', 'unwrapKey']
  );
}

/**
 * Wrap (encrypt) a DEK under a KEK using AES-GCM.
 * A fresh random 12-byte IV is generated for every call.
 *
 * Returns the wrapped DEK bytes and the IV. Both must be stored with the
 * vault_config or note — they are required for unwrapping.
 */
export async function wrapDek(
  dek: CryptoKey,
  kek: CryptoKey
): Promise<{ wrappedDek: ArrayBuffer; wrapIv: Uint8Array<ArrayBuffer> }> {
  const wrapIv = crypto.getRandomValues(new Uint8Array(12));
  const wrappedDek = await crypto.subtle.wrapKey(
    'raw',
    dek,
    kek,
    { name: 'AES-GCM', iv: wrapIv }
  );
  return { wrappedDek, wrapIv };
}

/**
 * Unwrap (decrypt) a previously wrapped DEK using the KEK.
 * Throws if the KEK is wrong or the wrapped bytes have been tampered with.
 *
 * The returned CryptoKey is NON-extractable by default — it can only be used
 * for AES-GCM operations in memory and cannot be exported.
 */
export async function unwrapDek(
  wrappedDek: ArrayBuffer,
  wrapIv: Uint8Array<ArrayBuffer>,
  kek: CryptoKey,
  extractable = false
): Promise<CryptoKey> {
  const safeIv = new Uint8Array(wrapIv);
  return crypto.subtle.unwrapKey(
    'raw',
    wrappedDek,
    kek,
    { name: 'AES-GCM', iv: safeIv },  // unwrap algorithm
    { name: 'AES-GCM', length: 256 }, // unwrapped key algorithm
    extractable,                      // non-extractable in runtime memory
    ['encrypt', 'decrypt', 'wrapKey', 'unwrapKey']
  );
}

/**
 * Rotate the KEK (e.g. on user password change) by unwrapping the existing
 * vault DEK under the current KEK and re-wrapping it under a newly derived KEK.
 * Zero note ciphertexts are touched during password rotation.
 */
export async function rotateVaultKek(
  wrappedDek: ArrayBuffer,
  dekIv: Uint8Array<ArrayBuffer>,
  currentKek: CryptoKey,
  newPassword: string
): Promise<{
  newSalt: Uint8Array<ArrayBuffer>;
  newAuthHash: string;
  newKek: CryptoKey;
  newWrappedDek: ArrayBuffer;
  newDekIv: Uint8Array<ArrayBuffer>;
  unwrappedDek: CryptoKey;
}> {
  // Temporarily unwrap as extractable only within this closure to re-wrap under newKek
  const transientDek = await unwrapDek(wrappedDek, dekIv, currentKek, true);
  const newSalt = generateSalt();
  const { masterKey: newKek, authHash: newAuthHash } = await deriveKeys(newPassword, newSalt);
  const { wrappedDek: newWrappedDek, wrapIv: newDekIv } = await wrapDek(transientDek, newKek);
  const unwrappedDek = await unwrapDek(newWrappedDek, newDekIv, newKek, false);

  return {
    newSalt,
    newAuthHash,
    newKek,
    newWrappedDek,
    newDekIv,
    unwrappedDek
  };
}
