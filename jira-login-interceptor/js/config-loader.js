/**
 * Shared configuration loader.
 *
 * Priority order:
 *   1. chrome.storage.managed  (enterprise policy via GPO / Intune — read-only)
 *   2. chrome.storage.local    (user overrides via options page)
 *   3. config.json             (bundled defaults)
 *
 * When config comes from managed policy, the returned object includes
 * `managedPolicy: true` so the options page can show a read-only notice.
 */
async function loadSettings() {
  // 1. Enterprise managed policy (highest priority)
  try {
    const managed = await new Promise((resolve, reject) => {
      chrome.storage.managed.get(['forgeEndpointUrl', 'apiKey'], (result) => {
        if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
        else resolve(result);
      });
    });
    if (managed.forgeEndpointUrl && managed.apiKey) {
      return { ...managed, managedPolicy: true };
    }
  } catch (e) {
    // No managed policy schema installed or no values set — fall through
  }

  // 2. User-saved settings
  const stored = await new Promise((resolve) => {
    chrome.storage.local.get(['forgeEndpointUrl', 'apiKey'], resolve);
  });
  if (stored.forgeEndpointUrl && stored.apiKey) {
    return stored;
  }

  // 3. Fallback: config.json (bundled defaults)
  try {
    const url = chrome.runtime.getURL('config.json');
    const response = await fetch(url);
    const config = await response.json();
    if (config.forgeEndpointUrl && config.apiKey) {
      return config;
    }
  } catch (e) {
    // config.json missing or invalid
  }

  return {};
}
