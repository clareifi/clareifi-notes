import { injectAnalytics } from '@vercel/analytics';
import { dev } from '$app/environment';

// Disable server-side rendering — this app uses browser-only APIs
// (Web Crypto, IndexedDB) and must run entirely on the client.
export const ssr = false;

// Initialize Vercel Web Analytics
injectAnalytics({ mode: dev ? 'development' : 'production' });
