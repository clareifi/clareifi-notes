<!-- Vault unlock — login flow -->
<script lang="ts">
  import { goto } from '$app/navigation';
  import { deriveKeys } from '$lib/crypto.js';
  import { getVaultConfig, saveVaultConfig, pullNotesFromSupabase } from '$lib/storage.js';
  import { session } from '$lib/stores.svelte.js';
  import { supabase } from '$lib/supabase.js';

  let email = $state('');
  let password = $state('');
  let error = $state('');
  let loading = $state(false);
  let loadingStatus = $state('unlocking…');

  function fromBase64(b64: string): Uint8Array {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }

  async function unlock(e: SubmitEvent) {
    e.preventDefault();
    error = '';
    loading = true;
    loadingStatus = 'unlocking…';

    try {
      const config = await getVaultConfig();

      if (!config) {
        // New device — sign in to Supabase and fetch the salt that was used
        // when the vault was originally created, so we derive the same key.
        loadingStatus = 'signing in…';
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) {
          error = 'sign-in failed — check your email and password';
          loading = false;
          return;
        }

        loadingStatus = 'fetching vault…';
        const { data: remoteConfig, error: fetchError } = await supabase
          .from('vault_config')
          .select('salt, auth_hash')
          .eq('user_id', signInData.user.id)
          .single();
        if (fetchError || !remoteConfig) {
          error = 'vault not found — create one first';
          loading = false;
          return;
        }

        const salt = fromBase64(remoteConfig.salt);
        const { masterKey, authHash } = await deriveKeys(password, salt);

        await saveVaultConfig({
          salt,
          authHash,
          email,
          createdAt: new Date().toISOString(),
        });

        session.setMasterKey(masterKey);

        loadingStatus = 'syncing…';
        try {
          const pulled = await pullNotesFromSupabase();
          if (pulled > 0) console.log(`[unlock] pulled ${pulled} note(s) from Supabase`);
        } catch (syncErr) {
          console.error('[unlock] pull failed:', syncErr);
        }

        goto('/');
        return;
      }

      // Local vault exists — existing flow unchanged
      const { masterKey, authHash } = await deriveKeys(password, config.salt);

      if (authHash !== config.authHash) {
        error = 'incorrect password';
        loading = false;
        return;
      }

      // Local auth is the source of truth — unlock the session now
      session.setMasterKey(masterKey);

      // Establish Supabase session for sync — non-blocking if it fails
      if (config.email) {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: config.email,
          password,
        });
        if (signInError) {
          console.error('[unlock] Supabase sign-in failed:', signInError.message);
        }
      }

      // Pull notes — no-op if no active session, never blocks vault access
      loadingStatus = 'syncing…';
      try {
        const pulled = await pullNotesFromSupabase();
        if (pulled > 0) console.log(`[unlock] pulled ${pulled} note(s) from Supabase`);
      } catch (syncErr) {
        console.error('[unlock] pull failed:', syncErr);
      }

      goto('/');
    } catch (err) {
      console.error(err);
      error = 'something went wrong — please try again';
      loading = false;
    }
  }
</script>

<div class="page">
  <div class="heading">
    <h1 class="title">unlock vault</h1>
    <p class="subtitle">enter your vault password to decrypt your notes</p>
  </div>

  <form onsubmit={unlock} class="form">
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
        placeholder="enter password"
        autocomplete="current-password"
        autofocus
        class="input"
      />
    </label>

    {#if error}
      <p class="error">{error}</p>
    {/if}

    <button type="submit" disabled={loading} class="btn-primary">
      {loading ? loadingStatus : 'unlock vault'}
    </button>
  </form>

  <p class="footer-link">
    <!-- Only show if vault might not exist yet -->
    first time? <a href="/setup" class="link">create a vault →</a>
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

  .footer-link {
    margin-top: 1.5rem;
    font-family: var(--font-mono);
    font-size: 0.7rem;
    color: var(--muted);
  }

  .link {
    color: var(--muted);
    text-decoration: underline;
    transition: color 0.15s;
  }
  .link:hover { color: var(--text); }
</style>
