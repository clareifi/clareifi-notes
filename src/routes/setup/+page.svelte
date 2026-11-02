<!-- Vault creation — first-run flow with Phase 3 Envelope Key Architecture -->
<script lang="ts">
  import { goto } from '$app/navigation';
  import { generateSalt, deriveKeys, generateDek, wrapDek, unwrapDek } from '$lib/crypto.js';
  import { saveVaultConfig, syncVaultConfigToSupabase } from '$lib/storage.js';
  import { session } from '$lib/stores.svelte.js';
  import { supabase } from '$lib/supabase.js';
  import type { VaultConfig } from '$lib/types.js';

  let email = $state('');
  let password = $state('');
  let confirmPassword = $state('');
  let showPassword = $state(false);
  let error = $state('');
  let loading = $state(false);
  let loadingStep = $state('deriving keys…');

  // Password strength calculation (0–4)
  let strengthScore = $derived.by(() => {
    if (!password) return 0;
    let score = 0;
    if (password.length >= 8) score++;
    if (password.length >= 12) score++;
    if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
    if (/\d/.test(password) || /[^A-Za-z0-9]/.test(password)) score++;
    return score;
  });

  let strengthLabel = $derived.by(() => {
    if (!password) return 'Min. 8 characters';
    if (password.length < 8) return 'Too short (min. 8 characters)';
    const labels = ['Weak', 'Fair', 'Good', 'Strong', 'Very strong'];
    return labels[strengthScore] ?? 'Good';
  });

  let passwordsMismatch = $derived(
    confirmPassword.length > 0 && password !== confirmPassword
  );

  let passwordsMatch = $derived(
    confirmPassword.length >= 8 && password === confirmPassword
  );

  async function createVault(e: SubmitEvent) {
    e.preventDefault();
    error = '';

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail.includes('@') || !normalizedEmail.includes('.')) {
      error = 'Please enter a valid email address.';
      return;
    }
    if (password.length < 8) {
      error = 'Vault password must be at least 8 characters.';
      return;
    }
    if (password !== confirmPassword) {
      error = 'Confirmation password does not match.';
      return;
    }

    loading = true;
    loadingStep = 'deriving key encryption key (310k iterations)…';
    try {
      const salt = generateSalt();
      const { masterKey: kek, authHash } = await deriveKeys(password, salt);

      loadingStep = 'generating envelope data key…';
      const rawDek = await generateDek();
      const { wrappedDek, wrapIv: dekIv } = await wrapDek(rawDek, kek);
      const dek = await unwrapDek(wrappedDek, dekIv, kek);

      const now = new Date().toISOString();
      const config: VaultConfig = {
        version: 2,
        salt,
        authHash,
        wrappedDek,
        dekIv,
        email: normalizedEmail,
        createdAt: now,
        updatedAt: now,
      };

      // Save locally first — local storage is always primary
      await saveVaultConfig(config);

      loadingStep = 'syncing encrypted vault metadata…';
      // Create Supabase Auth account and persist vault config remotely
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
      });

      let supabaseUserId: string | null = signUpData?.user?.id ?? null;

      if (signUpError) {
        if (signUpError.message.includes('User already registered')) {
          // Account exists (e.g. user cleared local data) — sign in instead
          const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
            email: normalizedEmail,
            password,
          });
          if (signInError) {
            console.error('[setup] Supabase sign-in fallback failed:', signInError.message);
          } else {
            supabaseUserId = signInData.user?.id ?? null;
          }
        } else {
          console.error('[setup] Supabase signUp failed:', signUpError.message);
        }
      }

      if (supabaseUserId) {
        await syncVaultConfigToSupabase(supabaseUserId, config);
      }

      // Ensure an active Supabase session exists before navigating away,
      // so that saveNote() can sync immediately on the notes page.
      if (supabaseUserId) {
        const { data: { session: activeSession } } = await supabase.auth.getSession();
        if (!activeSession) {
          const { error: sessionError } = await supabase.auth.signInWithPassword({
            email: normalizedEmail,
            password,
          });
          if (sessionError) {
            console.error('[setup] Supabase session establishment failed:', sessionError.message);
          }
        }
      }

      // Unlock the session — active DEK and KEK live in memory only
      session.setMasterKey(dek, kek);
      goto('/');
    } catch (err) {
      console.error(err);
      error = 'Unable to initialize your encrypted vault. Please try again.';
    } finally {
      loading = false;
    }
  }
</script>

<svelte:head>
  <title>Create Vault — Clareifi Notes</title>
</svelte:head>

<div class="flex-1 flex items-center justify-center px-4 py-10 sm:py-16">
  <div class="w-full max-w-md">
    <!-- Header Badge -->
    <div class="mb-6 flex items-center gap-2">
      <span class="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 text-[11px] font-mono text-emerald-400">
        <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
        </svg>
        zero-knowledge vault setup
      </span>
    </div>

    <!-- Main Card -->
    <div class="rounded-xl border border-neutral-800 bg-[var(--surface)] p-6 sm:p-8 shadow-2xl shadow-black/40">
      <div class="mb-6">
        <h1 class="text-xl font-semibold tracking-tight text-[var(--text)] mb-2">
          Create your encrypted vault
        </h1>
        <p class="text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed">
          Your notes are encrypted locally with an envelope Data Encryption Key (DEK) before leaving this device. We never see your password, keys, or plaintext.
        </p>
      </div>

      <form onsubmit={createVault} class="space-y-4" novalidate>
        <!-- Email Field -->
        <div class="space-y-1.5">
          <label for="setup-email" class="block text-xs font-mono text-[var(--text-secondary)]">
            email address
          </label>
          <input
            id="setup-email"
            type="email"
            bind:value={email}
            placeholder="you@example.com"
            autocomplete="email"
            required
            class="w-full rounded-lg border border-neutral-800 bg-[var(--bg)] px-3.5 py-2.5 text-sm text-[var(--text)] placeholder:text-neutral-600 transition duration-150 focus:border-emerald-500/60 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          />
        </div>

        <!-- Password Field -->
        <div class="space-y-1.5">
          <div class="flex items-center justify-between">
            <label for="setup-password" class="block text-xs font-mono text-[var(--text-secondary)]">
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
            id="setup-password"
            type={showPassword ? 'text' : 'password'}
            bind:value={password}
            placeholder="At least 8 characters"
            autocomplete="new-password"
            required
            class="w-full rounded-lg border border-neutral-800 bg-[var(--bg)] px-3.5 py-2.5 text-sm text-[var(--text)] placeholder:text-neutral-600 transition duration-150 focus:border-emerald-500/60 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          />

          <!-- Password Strength Bar -->
          <div class="pt-1 space-y-1">
            <div class="grid grid-cols-4 gap-1.5" aria-hidden="true">
              {#each [1, 2, 3, 4] as bar}
                <div
                  class="h-1 rounded-full transition-colors duration-150 {password.length === 0
                    ? 'bg-neutral-800'
                    : password.length < 8
                      ? bar === 1
                        ? 'bg-red-500/80'
                        : 'bg-neutral-800'
                      : strengthScore >= bar
                        ? strengthScore <= 1
                          ? 'bg-amber-400'
                          : strengthScore === 2
                            ? 'bg-amber-400'
                            : 'bg-emerald-400'
                        : 'bg-neutral-800'}"
                ></div>
              {/each}
            </div>
            <p class="text-[11px] font-mono text-[var(--muted)] flex items-center justify-between">
              <span>{strengthLabel}</span>
              <span class="tabular-nums">{password.length} chars</span>
            </p>
          </div>
        </div>

        <!-- Confirm Password Field -->
        <div class="space-y-1.5">
          <div class="flex items-center justify-between">
            <label for="setup-confirm" class="block text-xs font-mono text-[var(--text-secondary)]">
              confirm password
            </label>
            {#if passwordsMatch}
              <span class="text-[11px] font-mono text-emerald-400">✓ matches</span>
            {:else if passwordsMismatch}
              <span class="text-[11px] font-mono text-red-400">does not match</span>
            {/if}
          </div>
          <input
            id="setup-confirm"
            type={showPassword ? 'text' : 'password'}
            bind:value={confirmPassword}
            placeholder="Repeat vault password"
            autocomplete="new-password"
            required
            class="w-full rounded-lg border bg-[var(--bg)] px-3.5 py-2.5 text-sm text-[var(--text)] placeholder:text-neutral-600 transition duration-150 focus:outline-none focus:ring-2 {passwordsMismatch
              ? 'border-red-500/50 focus:border-red-500 focus:ring-red-500/20'
              : passwordsMatch
                ? 'border-emerald-500/40 focus:border-emerald-500/60 focus:ring-emerald-500/20'
                : 'border-neutral-800 focus:border-emerald-500/60 focus:ring-emerald-500/20'}"
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
            <span class="font-mono text-xs">{loadingStep}</span>
          {:else}
            <span>Create Encrypted Vault</span>
          {/if}
        </button>
      </form>

      <div class="mt-6 pt-5 border-t border-neutral-800/80 flex items-center justify-between text-xs font-mono text-[var(--muted)]">
        <span>Already have a vault?</span>
        <a
          href="/unlock"
          class="text-[var(--text-secondary)] hover:text-emerald-400 transition duration-150 underline underline-offset-4"
        >
          unlock existing vault →
        </a>
      </div>
    </div>

    <!-- Cryptographic Specification Footer -->
    <div class="mt-5 rounded-lg border border-neutral-900 bg-[var(--surface)]/50 px-4 py-3 text-[11px] font-mono text-[var(--muted)] leading-relaxed">
      <div class="flex items-center justify-between text-[var(--text-secondary)] mb-1">
        <span>Envelope Key Architecture (v2)</span>
        <span class="text-emerald-400/90">Web Crypto API</span>
      </div>
      <p class="m-0">
        KEK: PBKDF2-HMAC-SHA256 (310,000 iterations) · DEK: 256-bit AES-GCM non-extractable runtime key. Because zero-knowledge encryption is enforced, lost passwords cannot be recovered.
      </p>
    </div>
  </div>
</div>
