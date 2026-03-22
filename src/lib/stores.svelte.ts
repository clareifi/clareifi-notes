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
  isUnlocked: boolean = $state(false);

  /**
   * Set the master key after successful vault unlock.
   * The key lives in memory for the duration of the session only.
   */
  setMasterKey(key: CryptoKey): void {
    this.masterKey = key;
    this.isUnlocked = true;
  }

  /**
   * Clear the session — discard the master key from memory.
   * After this call, notes cannot be decrypted without re-entering
   * the vault password.
   */
  clearSession(): void {
    this.masterKey = null;
    this.isUnlocked = false;
  }
}

// Singleton instance — import and use directly in any Svelte component.
export const session = new SessionStore();
