<!-- Vault unlock — login flow with seamless Phase 2 → Phase 3 Envelope Upgrade -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { deriveKeys } from '$lib/crypto.js';
  import {
    getVaultConfig,
    saveVaultConfig,
    ensureVaultEnvelope,
    syncVaultConfigToSupabase,
    pullNotesFromSupabase,
    fromBase64,
  } from '$lib/storage.js';
  import { session } from '$lib/stores.svelte.js';
  import { supabase } from '$lib/supabase.js';
  import type { VaultConfig } from '$lib/types.js';

  let email = $state('');
  let password = $state('');
  let showPassword = $state(false);
  let error = $state('');
  let loading = $state(false);
  let loadingStatus = $state('unlocking vault…');
  let hasLocalVault = $state<boolean | null>(null);
  let isEnvelopeVault = $state(false);

  onMount(async () => {
    const config = await getVaultConfig();
    hasLocalVault = Boolean(config);
    if (config) {
      if (config.email) email = config.email;
      isEnvelopeVault = Boolean(config.wrappedDek && config.dekIv);
    }
  });

  async function fetchRemoteVaultConfig(userId: string): Promise<{
    salt: string;
    auth_hash: string;
    wrapped_dek?: string | null;
    dek_iv?: string | null;
  } | null> {
    const { data, error: err } = await supabase
      .from('vault_config')
      .select('salt, auth_hash, wrapped_dek, dek_iv')
      .eq('user_id', userId)
      .single();

    if (!err && data) return data;

    // Fallback to Phase 2 column selection if remote table hasn't added wrapped_dek / dek_iv yet
    const { data: legacyData, error: legacyErr } = await supabase
      .from('vault_config')
      .select('salt, auth_hash')
      .eq('user_id', userId)
      .single();

    if (legacyErr || !legacyData) return null;
    return legacyData;
  }

  async function unlock(e: SubmitEvent) {
    e.preventDefault();
    error = '';

    if (!password) {
      error = 'Please enter your vault password.';
      return;
    }

    loading = true;
    loadingStatus = 'deriving key…';

    try {
      const config = await getVaultConfig();
      const normalizedEmail = email.trim().toLowerCase();

      if (!config) {
        if (!normalizedEmail || !normalizedEmail.includes('@')) {
          error = 'Please enter your email address to restore your vault on this device.';
          loading = false;
          return;
        }

        // New device — sign in to Supabase and fetch the vault salt + wrapped DEK
        loadingStatus = 'authenticating device…';
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password,
        });
        if (signInError) {
          error = 'Sign-in failed. Please verify your email and vault password.';
          loading = false;
          return;
        }

        loadingStatus = 'fetching encrypted vault parameters…';
        const remoteConfig = await fetchRemoteVaultConfig(signInData.user.id);
        if (!remoteConfig) {
          error = 'No remote vault found for this account. Create a new vault first.';
          loading = false;
          return;
        }

        const salt = fromBase64(remoteConfig.salt);
        const { masterKey: kek, authHash } = await deriveKeys(password, salt);

        if (remoteConfig.auth_hash && authHash !== remoteConfig.auth_hash) {
          error = 'Incorrect vault password. Key verification failed.';
          loading = false;
          return;
        }

        const initialConfig: VaultConfig = {
          version: remoteConfig.wrapped_dek && remoteConfig.dek_iv ? 2 : 1,
          salt,
          authHash,
          wrappedDek: remoteConfig.wrapped_dek ? fromBase64(remoteConfig.wrapped_dek).buffer : undefined,
          dekIv: remoteConfig.dek_iv ? fromBase64(remoteConfig.dek_iv) : undefined,
          email: normalizedEmail,
          createdAt: new Date().toISOString(),
        };

        await saveVaultConfig(initialConfig);

        loadingStatus = 'unwrapping envelope key…';
        const { config: finalConfig, dek, upgraded } = await ensureVaultEnvelope(initialConfig, kek);
        if (upgraded) {
          await syncVaultConfigToSupabase(signInData.user.id, finalConfig);
        }

        session.setMasterKey(dek, kek);

        loadingStatus = 'syncing encrypted notes…';
        try {
          const pulled = await pullNotesFromSupabase();
          if (pulled > 0) console.log(`[unlock] pulled ${pulled} note(s) from Supabase`);
        } catch (syncErr) {
          console.error('[unlock] pull failed:', syncErr);
        }

        goto('/');
        return;
      }

      // Local vault exists — verify against local PBKDF2 authHash
      const { masterKey: kek, authHash } = await deriveKeys(password, config.salt);

      if (authHash !== config.authHash) {
        error = 'Incorrect vault password. Unable to unlock local vault.';
        loading = false;
        return;
      }

      // Seamless Phase 2 -> Phase 3 upgrade if vault doesn't have a wrapped DEK yet
      loadingStatus = config.wrappedDek ? 'unwrapping envelope key…' : 'upgrading vault to envelope v2…';
      const updatedBaseConfig: VaultConfig =
        !config.email && normalizedEmail ? { ...config, email: normalizedEmail } : config;

      const { config: finalConfig, dek, upgraded } = await ensureVaultEnvelope(updatedBaseConfig, kek);

      // Local auth is the source of truth — unlock the session now
      session.setMasterKey(dek, kek);

      // Establish Supabase session for sync — non-blocking if it fails
      const loginEmail = finalConfig.email || normalizedEmail;
      if (loginEmail) {
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email: loginEmail,
          password,
        });
        if (signInError) {
          console.error('[unlock] Supabase sign-in failed:', signInError.message);
        } else if (upgraded && signInData?.user?.id) {
          await syncVaultConfigToSupabase(signInData.user.id, finalConfig);
        }
      }

      // Pull notes — no-op if no active session, never blocks vault access
      loadingStatus = 'syncing encrypted notes…';
      try {
        const pulled = await pullNotesFromSupabase();
        if (pulled > 0) console.log(`[unlock] pulled ${pulled} note(s) from Supabase`);
      } catch (syncErr) {
        console.error('[unlock] pull failed:', syncErr);
      }

      goto('/');
    } catch (err) {
      console.error(err);
      error = 'Unable to unlock vault. Please check your password and try again.';
      loading = false;
    }
  }
</script>

<svelte:head>
  <title>Unlock Vault — Clareifi Notes</title>
</svelte:head>

<div class="flex-1 flex items-center justify-center px-4 py-10 sm:py-16">
  <div class="w-full max-w-md">
    <!-- Status Pill -->
    <div class="mb-6 flex items-center justify-between">
      <span class="inline-flex items-center gap-1.5 rounded-full bg-neutral-900 border border-neutral-800 px-2.5 py-1 text-[11px] font-mono text-[var(--text-secondary)]">
        <span class="h-1.5 w-1.5 rounded-full {hasLocalVault ? 'bg-emerald-400' : 'bg-amber-400'}"></span>
        {#if hasLocalVault === null}
          checking local storage…
        {:else if hasLocalVault}
          local vault detected {isEnvelopeVault ? '· envelope v2' : '· ready'}
        {:else}
          new device · cloud vault restore
        {/if}
      </span>
    </div>

    <!-- Main Unlock Card -->
    <div class="rounded-xl border border-neutral-800 bg-[var(--surface)] p-6 sm:p-8 shadow-2xl shadow-black/40">
      <div class="mb-6">
        <h1 class="text-xl font-semibold tracking-tight text-[var(--text)] mb-2">
          Unlock your vault
        </h1>
        <p class="text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed">
          Enter your vault password to derive your Key Encryption Key (KEK) and decrypt your notes locally in memory.
        </p>
      </div>

      <form onsubmit={unlock} class="space-y-4" novalidate>
        <!-- Email Input -->
        <div class="space-y-1.5">
          <div class="flex items-center justify-between">
            <label for="unlock-email" class="block text-xs font-mono text-[var(--text-secondary)]">
              email address
            </label>
            {#if hasLocalVault}
              <span class="text-[11px] font-mono text-[var(--muted)]">for encrypted sync</span>
            {/if}
          </div>
          <input
            id="unlock-email"
            type="email"
            bind:value={email}
            placeholder="you@example.com"
            autocomplete="email"
            class="w-full rounded-lg border border-neutral-800 bg-[var(--bg)] px-3.5 py-2.5 text-sm text-[var(--text)] placeholder:text-neutral-600 transition duration-150 focus:border-emerald-500/60 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          />
        </div>

        <!-- Vault Password Input -->
        <div class="space-y-1.5">
          <div class="flex items-center justify-between">
            <label for="unlock-password" class="block text-xs font-mono text-[var(--text-secondary)]">
              vault password
            </label>
            <button
              type="button"
              onclick={() => (showPassword = !showPassword)}
              class="text-[11px] font-mono text-[var(--muted)] hover:text-[var(--text)] transition duration-150"
            >
              {showPassword ? 'hide' : 'show'}
            </button>
          </div>
          <input
            id="unlock-password"
            type={showPassword ? 'text' : 'password'}
            bind:value={password}
            placeholder="Enter vault password"
            autocomplete="current-password"
            required
            class="w-full rounded-lg border border-neutral-800 bg-[var(--bg)] px-3.5 py-2.5 text-sm text-[var(--text)] placeholder:text-neutral-600 transition duration-150 focus:border-emerald-500/60 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          />
        </div>

        {#if error}
          <div
            role="alert"
            class="rounded-lg border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-xs font-mono text-red-300 flex items-start gap-2"
          >
            <svg class="w-4 h-4 text-red-400 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            <span>{error}</span>
          </div>
        {/if}

        <button
          type="submit"
          disabled={loading}
          class="w-full mt-2 inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-500 text-neutral-950 font-medium text-sm px-4 py-2.5 transition duration-150 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950"
        >
          {#if loading}
            <span class="h-3.5 w-3.5 rounded-full border-2 border-neutral-950/30 border-t-neutral-950 animate-spin"></span>
            <span class="font-mono text-xs">{loadingStatus}</span>
          {:else}
            <span>Unlock Vault</span>
          {/if}
        </button>
      </form>

      <div class="mt-6 pt-5 border-t border-neutral-800/80 flex items-center justify-between text-xs font-mono text-[var(--muted)]">
        <span>First time here?</span>
        <a
          href="/setup"
          class="text-[var(--text-secondary)] hover:text-emerald-400 transition duration-150 underline underline-offset-4"
        >
          create a vault →
        </a>
      </div>
    </div>

    <!-- Security Micro-copy -->
    <div class="mt-5 flex items-center justify-between px-2 text-[11px] font-mono text-[var(--muted)]">
      <span>PBKDF2 · 310,000 iterations</span>
      <span>Keys live in RAM only</span>
    </div>
  </div>
</div>
