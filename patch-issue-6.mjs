import { readFileSync, writeFileSync } from 'fs';

let storage = readFileSync('src/lib/storage.ts', 'utf8');

storage = storage.replace(
  `  return btoa(binary);
}`,
  `  return btoa(binary);
}

/** Decode a base64 string back to a Uint8Array. */
function fromBase64(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}`
);

storage = storage.replace(
  `export async function deleteNote(id: string): Promise<void> {`,
  `export async function pullNotesFromSupabase(): Promise<number> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return 0;

  const { data: rows, error } = await supabase
    .from('notes')
    .select('id, ciphertext, iv, title_ciphertext, title_iv, created_at, updated_at')
    .eq('user_id', user.id);

  if (error) { console.error('[storage] pullNotesFromSupabase failed:', error.message); return 0; }
  if (!rows || rows.length === 0) return 0;

  let written = 0;
  for (const row of rows) {
    const localNote = await get(\`note:\${row.id}\`);
    if (localNote) {
      if (new Date(localNote.updatedAt).getTime() >= new Date(row.updated_at).getTime()) continue;
    }
    await set(\`note:\${row.id}\`, {
      id: row.id,
      iv: (() => { const b = atob(row.iv); const a = new Uint8Array(b.length); for(let i=0;i<b.length;i++) a[i]=b.charCodeAt(i); return a; })(),
      ciphertext: (() => { const b = atob(row.ciphertext); const a = new Uint8Array(b.length); for(let i=0;i<b.length;i++) a[i]=b.charCodeAt(i); return a.buffer; })(),
      titleIv: row.title_iv ? (() => { const b = atob(row.title_iv); const a = new Uint8Array(b.length); for(let i=0;i<b.length;i++) a[i]=b.charCodeAt(i); return a; })() : undefined,
      titleCiphertext: row.title_ciphertext ? (() => { const b = atob(row.title_ciphertext); const a = new Uint8Array(b.length); for(let i=0;i<b.length;i++) a[i]=b.charCodeAt(i); return a.buffer; })() : undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
    written++;
  }
  return written;
}

export async function deleteNote(id: string): Promise<void> {`
);

writeFileSync('src/lib/storage.ts', storage);
console.log('✓ storage.ts patched');

let page = readFileSync('src/routes/unlock/+page.svelte', 'utf8');
page = page.replace(`import { getVaultConfig } from '$lib/storage.js';`, `import { getVaultConfig, pullNotesFromSupabase } from '$lib/storage.js';`);
page = page.replace(`  let loading = $state(false);`, `  let loading = $state(false);\n  let loadingStatus = $state('unlocking…');`);
page = page.replace(`    loading = true;`, `    loading = true;\n    loadingStatus = 'unlocking…';`);
page = page.replace(
  `        if (signInError) {\n          console.error('[unlock] Supabase sign-in failed:', signInError.message);\n        }`,
  `        if (signInError) {\n          console.error('[unlock] Supabase sign-in failed:', signInError.message);\n        } else {\n          loadingStatus = 'syncing…';\n          try {\n            const pulled = await pullNotesFromSupabase();\n            if (pulled > 0) console.log(\`[unlock] pulled \${pulled} note(s) from Supabase\`);\n          } catch (syncErr) { console.error('[unlock] pull failed:', syncErr); }\n        }`
);
page = page.replace(`{loading ? 'unlocking…' : 'unlock vault'}`, `{loading ? loadingStatus : 'unlock vault'}`);
writeFileSync('src/routes/unlock/+page.svelte', page);
console.log('✓ unlock/+page.svelte patched');
