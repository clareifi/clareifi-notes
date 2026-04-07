<!-- Vault creation — first-run flow -->
<script lang="ts">
  import { goto } from '$app/navigation';
  import { generateSalt, deriveKeys } from '$lib/crypto.js';
  import { saveVaultConfig } from '$lib/storage.js';
  import { session } from '$lib/stores.svelte.js';
  import { supabase } from '$lib/supabase.js';

  let email = $state('');
  let password = $state('');
  let confirmPassword = $state('');
  let error = $state('');
  let loading = $state(false);

  function toBase64(bytes: Uint8Array): string {
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  }

  async function createVault(e: SubmitEvent) {
    e.preventDefault();
    error = '';

    if (!email.includes('@')) {
      error = 'please enter a valid email address';
      return;
    }
    if (password.length < 8) {
      error = 'password must be at least 8 characters';
      return;
    }
    if (password !== confirmPassword) {
      error = 'passwords do not match';
      return;
    }

    loading = true;
    try {
      const salt = generateSalt();
      const { masterKey, authHash } = await deriveKeys(password, salt);

      // Save locally first — local storage is always primary
      await saveVaultConfig({
        salt,
        authHash,
        email,
        createdAt: new Date().toISOString(),
      });

      // Create Supabase Auth account and persist vault config remotely
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
      });

      let supabaseUserId: string | null = signUpData?.user?.id ?? null;

      if (signUpError) {
        if (signUpError.message.includes('User already registered')) {
          // Account exists (e.g. user cleared local data) — sign in instead
          const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
            email,
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
        const { error: upsertError } = await supabase.from('vault_config').upsert({
          user_id: supabaseUserId,
          salt: toBase64(salt),
          auth_hash: authHash,
        }, { onConflict: 'user_id' });
        if (upsertError) {
          console.error('[setup] vault_config upsert failed:', upsertError.message);
        }
      }

      // Unlock the session — master key lives in memory only
      session.setMasterKey(masterKey);
      goto('/');
    } catch (err) {
      console.error(err);
      error = 'failed to create vault — please try again';
    } finally {
      loading = false;
    }
  }
</script>

<div class="page">
  <div class="heading">
    <h1 class="title">create vault</h1>
    <p class="subtitle">
      your notes will be encrypted on this device using AES-GCM.<br />
      the vault password is never stored — only a separate verification hash.
    </p>
  </div>

  <form onsubmit={createVault} class="form">
    <label class="field">
      <span class="label">email</span>
      <input
        type="email"
        bind:value={email}
        placeholder="you@example.com"
        autocomplete="email"
        class="input"
      />
    </label>

    <label class="field">
      <span class="label">vault password</span>
      <input
        type="password"
        bind:value={password}
        placeholder="min. 8 characters"
        autocomplete="new-password"
        class="input"
      />
    </label>

    <label class="field">
      <span class="label">confirm password</span>
      <input
        type="password"
        bind:value={confirmPassword}
        placeholder="repeat password"
        autocomplete="new-password"
        class="input"
      />
    </label>

    {#if error}
      <p class="error">{error}</p>
    {/if}

    <button type="submit" disabled={loading} class="btn-primary">
      {loading ? 'creating vault…' : 'create vault'}
    </button>
  </form>

  <p class="footer-note">
    encryption: AES-GCM 256-bit · key derivation: PBKDF2 (310,000 iterations, SHA-256)<br />
    your key never leaves this device
  </p>
</div>

<style>
  .page {
    max-width: 420px;
    margin: 0 auto;
    padding: 5rem 1.5rem 2rem;
  }

  .heading {
    margin-bottom: 2rem;
  }

  .title {
    font-family: var(--font-mono);
    font-size: 1.125rem;
    font-weight: 500;
    color: var(--text);
    margin: 0 0 0.5rem;
  }

  .subtitle {
    font-family: var(--font-mono);
    font-size: 0.7rem;
    color: var(--muted);
    line-height: 1.6;
    margin: 0;
  }

  .form {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .label {
    font-family: var(--font-mono);
    font-size: 0.7rem;
    color: var(--muted);
  }

  .input {
    width: 100%;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 4px;
    padding: 0.5rem 0.75rem;
    font-family: var(--font-mono);
    font-size: 0.875rem;
    color: var(--text);
    outline: none;
    transition: border-color 0.15s;
  }
  .input:focus { border-color: var(--muted); }
  .input::placeholder { color: var(--muted); }

  .error {
    font-family: var(--font-mono);
    font-size: 0.7rem;
    color: #f87171;
    margin: 0;
  }

  .btn-primary {
    width: 100%;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 4px;
    padding: 0.5rem 0.75rem;
    font-family: var(--font-mono);
    font-size: 0.75rem;
    color: var(--text);
    cursor: pointer;
    transition: border-color 0.15s;
  }
  .btn-primary:hover:not(:disabled) { border-color: var(--muted); }
  .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

  .footer-note {
    margin-top: 2rem;
    font-family: var(--font-mono);
    font-size: 0.65rem;
    color: var(--muted);
    line-height: 1.6;
    opacity: 0.7;
  }
</style>
