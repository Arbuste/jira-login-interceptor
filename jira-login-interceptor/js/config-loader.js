/**
 * Shared configuration loader.
 * Tries config.json first (admin-provided), falls back to chrome.storage.local.
 */
async function loadSettings() {
  // Try config.json (bundled with the extension)
  try {
    const url = chrome.runtime.getURL('config.json');
    const response = await fetch(url);
    const config = await response.json();
    if (config.orgId && config.directoryId && config.groupId && config.bearerToken) {
      return config;
    }
  } catch (e) {
    // config.json missing or invalid — fall through to storage
  }

  // Fallback: chrome.storage.local (manual configuration via options page)
  return new Promise((resolve) => {
    chrome.storage.local.get(['orgId', 'directoryId', 'groupId', 'bearerToken'], resolve);
  });
}
