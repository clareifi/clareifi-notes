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

  // Derive the master key (non-extractable AES-GCM 256-bit)
  const masterKey = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 310_000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,       // non-extractable — the key can never be exported
    ['encrypt', 'decrypt']
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
