// Stored in IndexedDB — no plaintext fields
export interface EncryptedNote {
  id: string;           // crypto.randomUUID()
  iv: Uint8Array;       // 12 bytes, random per operation
  ciphertext: ArrayBuffer; // AES-GCM encrypted content
  createdAt: string;    // ISO 8601
  updatedAt: string;    // ISO 8601
}

// Stored in IndexedDB at key 'vault_config'
export interface VaultConfig {
  salt: Uint8Array;     // 16 bytes, random, generated on vault creation
  authHash: string;     // hex-encoded PBKDF2 derivation — NOT the master key
  createdAt: string;
}

// Lives in Svelte store only — NEVER persisted
export interface SessionState {
  masterKey: CryptoKey | null;
  isUnlocked: boolean;
}
