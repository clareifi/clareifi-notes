/**
 * Clareifi Notes — Session State Store
 *
 * The masterKey lives in memory only — it is NEVER persisted.
 * On logout the key is discarded and the app must be re-unlocked.
 */

import { writable } from 'svelte/store';
import type { SessionState } from './types';

function createSessionStore() {
    const { subscribe, set, update } = writable<SessionState>({
        masterKey: null,
        isUnlocked: false
    });

    return {
        subscribe,

        /** Store the derived masterKey in memory and mark session as unlocked */
        unlock(masterKey: CryptoKey) {
            set({ masterKey, isUnlocked: true });
        },

        /** Discard the masterKey and lock the session */
        lock() {
            set({ masterKey: null, isUnlocked: false });
        }
    };
}

export const sessionStore = createSessionStore();
