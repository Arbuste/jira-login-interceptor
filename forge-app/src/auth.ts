import { getApiKey } from './storage';

/**
 * Validates the Authorization header against the stored API key in KVS.
 * Uses constant-time comparison to prevent timing attacks.
 */
export async function validateApiKey(authHeader: string): Promise<boolean> {
  if (!authHeader.startsWith('Bearer ')) {
    return false;
  }

  const providedKey = authHeader.slice(7);
  const expectedKey = await getApiKey();

  if (!expectedKey) {
    console.error('API key is not configured — generate one from the admin page');
    return false;
  }

  if (providedKey.length !== expectedKey.length) {
    return false;
  }

  // Constant-time comparison
  let mismatch = 0;
  for (let i = 0; i < providedKey.length; i++) {
    mismatch |= providedKey.charCodeAt(i) ^ expectedKey.charCodeAt(i);
  }
  return mismatch === 0;
}
