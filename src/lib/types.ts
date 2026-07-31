// Stored in IndexedDB — no plaintext fields
export interface EncryptedNote {
  id: string;           // crypto.randomUUID()
  // Encryption version. Absent or 1 = direct master-key (legacy).
  // 2 = envelope encryption (DEK wrapped under KEK).
  version?: 1 | 2;
  iv: Uint8Array;       // 12 bytes, random per operation
  ciphertext: ArrayBuffer; // AES-GCM encrypted content
  titleIv?: Uint8Array;          // 12 bytes, random per operation
  titleCiphertext?: ArrayBuffer; // AES-GCM encrypted title
  // v2 envelope fields — required when version === 2
  wrappedDek?: ArrayBuffer; // AES-GCM encrypted DEK (48 bytes: 32 key + 16 GCM tag)
  wrapIv?: Uint8Array;      // 12-byte IV used to wrap the DEK
  createdAt: string;    // ISO 8601
  updatedAt: string;    // ISO 8601
}

// Stored in IndexedDB at key 'vault_config'
export interface VaultConfig {
  salt: Uint8Array;     // 16 bytes, random, generated on vault creation
  authHash: string;     // hex-encoded PBKDF2 derivation — NOT the master key
  email?: string;       // stored locally so unlock can sign in to Supabase without re-asking
  createdAt: string;
}

// Lives in Svelte store only — NEVER persisted
export interface SessionState {
  masterKey: CryptoKey | null;
  isUnlocked: boolean;
}
