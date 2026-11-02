/**
 * stores.svelte.ts — Session state using Svelte 5 runes.
 *
 * The master key NEVER leaves this module's memory. It is not persisted
 * to localStorage, IndexedDB, or any other storage mechanism.
 *
 * This file uses the .svelte.ts extension so that Svelte 5 rune syntax
 * ($state) is available at module level.
 */

class SessionStore {
  masterKey: CryptoKey | null = $state(null);
  kek: CryptoKey | null = $state(null);
  isUnlocked: boolean = $state(false);
  envelopeActive: boolean = $state(false);

  /**
   * Set the active masterKey (DEK or legacy key) and optional KEK after successful vault unlock.
   * All keys live in memory for the duration of the session only.
   */
  setMasterKey(key: CryptoKey, kek?: CryptoKey | null): void {
    this.masterKey = key;
    this.kek = kek ?? key;
    this.envelopeActive = Boolean(kek && kek !== key);
    this.isUnlocked = true;
  }

  /**
   * Clear the session — discard both masterKey (DEK) and KEK from memory.
   * After this call, notes cannot be decrypted without re-entering
   * the vault password.
   */
  clearSession(): void {
    this.masterKey = null;
    this.kek = null;
    this.envelopeActive = false;
    this.isUnlocked = false;
  }
}

// Singleton instance — import and use directly in any Svelte component.
export const session = new SessionStore();
