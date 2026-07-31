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
export function generateSalt(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(16));
}

/**
 * Derive a master key (for AES-GCM encryption) and an auth hash
 * (for local password verification) from the user's password and salt.
 *
 * Two separate PBKDF2 derivations are performed:
 *   1. masterKey  — non-extractable CryptoKey for AES-GCM
 *   2. authHash   — hex string used only to verify login locally
 *
 * The auth hash uses a modified salt (original salt + 0xFF byte) so
 * the two derivations are cryptographically independent.
 */
export async function deriveKeys(
  password: string,
  salt: Uint8Array
): Promise<{ masterKey: CryptoKey; authHash: string }> {
  const enc = new TextEncoder();

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
    { name: 'PBKDF2', salt, iterations: 310_000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,       // non-extractable — the key can never be exported
    ['encrypt', 'decrypt', 'wrapKey', 'unwrapKey']
  );

  // Derive the auth hash using a salt variant (salt || 0xFF)
  // This keeps the auth hash cryptographically separate from the master key
  const authSalt = new Uint8Array([...salt, 0xff]);
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
): Promise<{ iv: Uint8Array; ciphertext: ArrayBuffer }> {
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
  iv: Uint8Array,
  masterKey: CryptoKey
): Promise<string> {
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    masterKey,
    ciphertext
  );
  return new TextDecoder().decode(plaintext);
}

// ── Envelope encryption primitives ───────────────────────────────────────────
//
// These functions implement the DEK (Data Encryption Key) layer.
// Each note gets its own random DEK. The DEK is wrapped (encrypted) under
// the KEK (Key Encryption Key — the PBKDF2-derived master key) and stored
// alongside the note. Re-keying only touches the wrapped DEKs, never the
// note ciphertext.

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
    ['encrypt', 'decrypt']
  );
}

/**
 * Wrap (encrypt) a DEK under a KEK using AES-GCM.
 * A fresh random 12-byte IV is generated for every call.
 *
 * Returns the wrapped DEK bytes and the IV. Both must be stored with the
 * note — they are required for unwrapping.
 */
export async function wrapDek(
  dek: CryptoKey,
  kek: CryptoKey
): Promise<{ wrappedDek: ArrayBuffer; wrapIv: Uint8Array<ArrayBuffer> }> {
  const wrapIv = crypto.getRandomValues(new Uint8Array(12)) as Uint8Array<ArrayBuffer>;
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
 * The returned CryptoKey is NON-extractable — it can only be used for
 * AES-GCM encrypt/decrypt operations and cannot be re-exported.
 */
export async function unwrapDek(
  wrappedDek: ArrayBuffer,
  wrapIv: Uint8Array<ArrayBuffer>,
  kek: CryptoKey
): Promise<CryptoKey> {
  return crypto.subtle.unwrapKey(
    'raw',
    wrappedDek,
    kek,
    { name: 'AES-GCM', iv: wrapIv },  // unwrap algorithm
    { name: 'AES-GCM', length: 256 },  // unwrapped key algorithm
    false,                              // non-extractable after unwrap
    ['encrypt', 'decrypt']
  );
}
