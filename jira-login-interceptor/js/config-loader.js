/**
 * Shared configuration loader.
 * Tries chrome.storage.local first (user overrides), falls back to config.json.
 */
async function loadSettings() {
  // User-saved settings take priority
  const stored = await new Promise((resolve) => {
    chrome.storage.local.get(['forgeEndpointUrl', 'apiKey'], resolve);
  });
  if (stored.forgeEndpointUrl && stored.apiKey) {
    return stored;
  }

  // Fallback: config.json (bundled defaults)
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
