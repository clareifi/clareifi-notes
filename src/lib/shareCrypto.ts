/**
 * shareCrypto.ts — Phase 3 Zero-Knowledge Selective Note Sharing.
 *
 * Implements encrypted URL fragment sharing (#key=<base64url>).
 * Per RFC 3986, URI fragments (#...) are resolved strictly on the client
 * and are NEVER sent in HTTP requests to the server or CDN.
 *
 * Security invariants:
 * - Each shared snapshot uses an independent random 256-bit AES-GCM share key.
 * - The vault masterKey / DEK is NEVER placed in a share link.
 * - Imported share keys are marked non-extractable in Web Crypto memory.
 */

import { encryptNote, decryptNote } from './crypto.js';
import type { SharedNotePayload } from './types.js';

/** Encode bytes into URL-safe Base64 (no +, /, or = padding). */
export function toBase64Url(bytes: Uint8Array | ArrayBuffer): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = '';
  for (let i = 0; i < arr.length; i++) binary += String.fromCharCode(arr[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Decode URL-safe Base64 back to a Uint8Array<ArrayBuffer>. */
export function fromBase64Url(b64url: string): Uint8Array<ArrayBuffer> {
  const padded = b64url.replace(/-/g, '+').replace(/_/g, '/');
  const padLen = (4 - (padded.length % 4)) % 4;
  const binary = atob(padded + '='.repeat(padLen));
  const buffer = new ArrayBuffer(binary.length);
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/**
 * Create an encrypted share payload and a zero-knowledge URL fragment (#key=...).
 * The returned `fragmentKey` goes strictly into the URL hash (`#key=${fragmentKey}`).
 */
export async function createEncryptedSharePackage(
  content: string,
  title?: string
): Promise<{
  payload: SharedNotePayload;
  fragmentKey: string;
}> {
  const shareKey = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );

  const rawKey = await crypto.subtle.exportKey('raw', shareKey);
  const fragmentKey = toBase64Url(rawKey);

  const { iv, ciphertext } = await encryptNote(content, shareKey);
  let titleIv: string | undefined;
  let titleCiphertext: string | undefined;

  if (title && title.trim()) {
    const encTitle = await encryptNote(title.trim(), shareKey);
    titleIv = toBase64Url(encTitle.iv);
    titleCiphertext = toBase64Url(encTitle.ciphertext);
  }

  const payload: SharedNotePayload = {
    id: crypto.randomUUID(),
    version: 2,
    iv: toBase64Url(iv),
    ciphertext: toBase64Url(ciphertext),
    titleIv,
    titleCiphertext,
    createdAt: new Date().toISOString(),
  };

  return { payload, fragmentKey };
}

/**
 * Extract the `key` parameter from a URL hash fragment (e.g. `#key=abc...`).
 */
export function extractShareKeyFromHash(hash: string): string | null {
  const clean = hash.startsWith('#') ? hash.slice(1) : hash;
  const params = new URLSearchParams(clean);
  return params.get('key');
}

/**
 * Decrypt a SharedNotePayload using the base64url key extracted from `location.hash`.
 * The imported key is immediately marked non-extractable.
 */
export async function decryptSharedPackage(
  payload: SharedNotePayload,
  fragmentKey: string
): Promise<{ content: string; title?: string }> {
  const keyBytes = fromBase64Url(fragmentKey);
  const shareKey = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'AES-GCM', length: 256 },
    false, // non-extractable
    ['decrypt']
  );

  const content = await decryptNote(
    fromBase64Url(payload.ciphertext).buffer,
    fromBase64Url(payload.iv),
    shareKey
  );

  let title: string | undefined;
  if (payload.titleCiphertext && payload.titleIv) {
    title = await decryptNote(
      fromBase64Url(payload.titleCiphertext).buffer,
      fromBase64Url(payload.titleIv),
      shareKey
    );
  }

  return { content, title };
}
