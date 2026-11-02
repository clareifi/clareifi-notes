// Stored in IndexedDB — no plaintext fields
export interface EncryptedNote {
  id: string;                        // crypto.randomUUID()
  // Encryption version. Absent or 1 = direct key (legacy Phase 1/2).
  // 2 = envelope encryption (DEK wrapped under KEK).
  version?: 1 | 2;
  iv: Uint8Array<ArrayBuffer>;       // 12 bytes, random per operation
  ciphertext: ArrayBuffer;           // AES-GCM encrypted content
  titleIv?: Uint8Array<ArrayBuffer>; // 12 bytes, random per operation
  titleCiphertext?: ArrayBuffer;     // AES-GCM encrypted title
  // v2 envelope fields — required when version === 2 (per-note DEK wrap)
  wrappedDek?: ArrayBuffer;          // AES-GCM encrypted DEK (48 bytes: 32 key + 16 GCM tag)
  wrapIv?: Uint8Array<ArrayBuffer>;  // 12-byte IV used to wrap the DEK
  createdAt: string;                 // ISO 8601
  updatedAt: string;                 // ISO 8601
}

// Stored in IndexedDB at key 'vault_config' and synced to Supabase 'vault_config'
export interface VaultConfig {
  // Vault key hierarchy version:
  // Absent or 1 = Phase 2 (PBKDF2 masterKey used directly)
  // 2 = Phase 3 Envelope Architecture (PBKDF2 derives KEK, which wraps random DEK)
  version?: 1 | 2;
  salt: Uint8Array<ArrayBuffer>;     // 16 bytes, random, generated on vault creation
  authHash: string;                  // hex-encoded PBKDF2 derivation — NOT the master key
  wrappedDek?: ArrayBuffer;          // Vault-level DEK encrypted by KEK (maps to wrapped_dek)
  dekIv?: Uint8Array<ArrayBuffer>;   // 12-byte IV for vault-level DEK (maps to dek_iv)
  email?: string;                    // stored locally so unlock can sign in to Supabase without re-asking
  createdAt: string;                 // ISO 8601
  updatedAt?: string;                // ISO 8601 (set on migration or password rotation)
}

// Lives in Svelte store only — NEVER persisted
export interface SessionState {
  masterKey: CryptoKey | null;       // Active note key (unwrapped DEK or KEK)
  kek?: CryptoKey | null;            // PBKDF2-derived Key Encryption Key (in-memory only)
  isUnlocked: boolean;
}

// ── Phase 3 Scaffolding: Public Profiles & Zero-Knowledge Sharing ────────────

export interface PublicProfile {
  username: string;
  displayName?: string;
  bio?: string;
  keyFingerprint?: string;           // SHA-256 fingerprint of public verification identity
  publishedNoteCount?: number;
  createdAt: string;
}

export interface SharedNotePayload {
  id: string;
  version: 2;
  iv: string;                        // base64url-encoded 12-byte IV
  ciphertext: string;                // base64url-encoded AES-GCM ciphertext
  titleIv?: string;                  // base64url-encoded 12-byte title IV
  titleCiphertext?: string;          // base64url-encoded AES-GCM title ciphertext
  createdAt: string;
  expiresAt?: string;
}
