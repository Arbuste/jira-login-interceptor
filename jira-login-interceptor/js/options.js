/**
 * Options page script
 * Handles saving and loading user settings
 */

document.addEventListener('DOMContentLoaded', loadSettings);

const form = document.getElementById('settingsForm');
const forgeEndpointUrlInput = document.getElementById('forgeEndpointUrl');
const apiKeyInput = document.getElementById('apiKey');
const saveBtn = document.getElementById('saveBtn');
const resetBtn = document.getElementById('resetBtn');
const testBtn = document.getElementById('testBtn');
const statusMessage = document.getElementById('statusMessage');

// Load saved settings (storage first, then config.json fallback)
function loadSettings() {
  chrome.storage.local.get(['forgeEndpointUrl', 'apiKey'], async (result) => {
    if (result.forgeEndpointUrl || result.apiKey) {
      if (result.forgeEndpointUrl) forgeEndpointUrlInput.value = result.forgeEndpointUrl;
      if (result.apiKey) apiKeyInput.value = result.apiKey;
      return;
    }

    // Nothing in storage — try to populate from config.json
    try {
      const url = chrome.runtime.getURL('config.json');
      const response = await fetch(url);
      const config = await response.json();
      if (config.forgeEndpointUrl) forgeEndpointUrlInput.value = config.forgeEndpointUrl;
      if (config.apiKey) apiKeyInput.value = config.apiKey;
      showStatus('Loaded from config.json. Click "Save Settings" to persist.', 'success');
    } catch (e) {
      // No config.json either — fields stay empty
    }
  });
}

// Save settings
form.addEventListener('submit', (e) => {
  e.preventDefault();

  const forgeEndpointUrl = forgeEndpointUrlInput.value.trim();
  const apiKey = apiKeyInput.value.trim();

  if (!forgeEndpointUrl || !apiKey) {
    showStatus('Please fill in all required fields (*)', 'error');
    return;
  }

  // Validate URL
  try {
    const parsed = new URL(forgeEndpointUrl);
    if (parsed.protocol !== 'https:') {
      showStatus('Forge Endpoint URL must use HTTPS', 'error');
      return;
    }
  } catch {
    showStatus('Forge Endpoint URL is not a valid URL', 'error');
    return;
  }

  chrome.storage.local.set({ forgeEndpointUrl, apiKey }, () => {
    showStatus('Settings saved successfully!', 'success');
    setTimeout(() => {
      statusMessage.className = 'status-message';
    }, 5000);
  });
});

// Test connection button
testBtn.addEventListener('click', async () => {
  const forgeEndpointUrl = forgeEndpointUrlInput.value.trim();
  const apiKey = apiKeyInput.value.trim();

  if (!forgeEndpointUrl || !apiKey) {
    showStatus('Please fill in both fields before testing.', 'error');
    return;
  }

  showStatus('Testing connection...', 'success');

  // Step 1: Test endpoint reachability with a bad key to isolate network issues
  try {
    const reachResponse = await fetch(forgeEndpointUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'verifyMembership', accountId: 'test-connection' })
    });
    // Any response (even 401) means the endpoint is reachable
    if (!reachResponse.ok && reachResponse.status !== 401) {
      const text = await reachResponse.text();
      showStatus(`Endpoint responded with unexpected status ${reachResponse.status}: ${text}`, 'error');
      return;
    }
  } catch (err) {
    showStatus(`Endpoint unreachable: ${err.message}`, 'error');
    return;
  }

  // Step 2: Test with the actual API key
  try {
    const response = await fetch(forgeEndpointUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ action: 'verifyMembership', accountId: 'test-connection' })
    });

    if (response.status === 401) {
      showStatus('Endpoint reachable, but the API key is invalid.', 'error');
      return;
    }

    let data = {};
    try { data = await response.json(); } catch { /* ignore */ }

    if (response.ok) {
      showStatus('All good! Endpoint reachable, API key valid, Forge app configured.', 'success');
    } else if (response.status === 500 && data.error && data.error.includes('not configured')) {
      showStatus('Endpoint reachable and API key valid, but the Forge app is not fully configured yet (set org/directory/group in the Jira admin page).', 'error');
    } else {
      showStatus(`Endpoint reachable, API key valid, but got error: ${data.error || response.status}`, 'error');
    }
  } catch (err) {
    showStatus(`Connection test failed: ${err.message}`, 'error');
  }
});

// ── Drop zone ──
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');

dropZone.addEventListener('click', () => fileInput.click());

dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('dragover');
});

dropZone.addEventListener('dragleave', () => {
  dropZone.classList.remove('dragover');
});

dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('dragover');
  const file = e.dataTransfer.files[0];
  if (file) handleConfigFile(file);
});

fileInput.addEventListener('change', () => {
  const file = fileInput.files[0];
  if (file) handleConfigFile(file);
  fileInput.value = '';
});

function handleConfigFile(file) {
  if (!file.name.endsWith('.json')) {
    flashDropZone('error');
    showStatus('Please drop a .json file.', 'error');
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    let config;
    try {
      config = JSON.parse(e.target.result);
    } catch {
      flashDropZone('error');
      showStatus('Invalid JSON file.', 'error');
      return;
    }

    const errors = [];

    if (!config.forgeEndpointUrl || typeof config.forgeEndpointUrl !== 'string') {
      errors.push('Missing or invalid "forgeEndpointUrl"');
    } else {
      try {
        const parsed = new URL(config.forgeEndpointUrl);
        if (parsed.protocol !== 'https:') errors.push('"forgeEndpointUrl" must use HTTPS');
      } catch {
        errors.push('"forgeEndpointUrl" is not a valid URL');
      }
    }

    if (!config.apiKey || typeof config.apiKey !== 'string') {
      errors.push('Missing or invalid "apiKey"');
    }

    if (errors.length > 0) {
      flashDropZone('error');
      showStatus('Config file validation failed: ' + errors.join('; '), 'error');
      return;
    }

    forgeEndpointUrlInput.value = config.forgeEndpointUrl.trim();
    apiKeyInput.value = config.apiKey.trim();
    flashDropZone('success');
    showStatus('Config imported. Click "Save Settings" to persist.', 'success');
  };
  reader.readAsText(file);
}

function flashDropZone(type) {
  dropZone.classList.add(`drop-${type}`);
  setTimeout(() => dropZone.classList.remove(`drop-${type}`), 2000);
}

// Reset button
resetBtn.addEventListener('click', () => {
  if (confirm('Are you sure you want to clear all settings? This cannot be undone.')) {
    chrome.storage.local.remove(['forgeEndpointUrl', 'apiKey'], () => {
      forgeEndpointUrlInput.value = '';
      apiKeyInput.value = '';
      showStatus('All settings cleared', 'success');
    });
  }
});

// Show status message
function showStatus(message, type) {
  statusMessage.textContent = message;
  statusMessage.className = `status-message ${type}`;
}
