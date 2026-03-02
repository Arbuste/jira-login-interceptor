/**
 * Options page script
 * Handles saving and loading user settings
 */

document.addEventListener('DOMContentLoaded', loadSettings);

const form = document.getElementById('settingsForm');
const orgIdInput = document.getElementById('orgId');
const directoryIdInput = document.getElementById('directoryId');
const groupIdInput = document.getElementById('groupId');
const bearerTokenInput = document.getElementById('bearerToken');
const saveBtn = document.getElementById('saveBtn');
const loadConfigBtn = document.getElementById('loadConfigBtn');
const resetBtn = document.getElementById('resetBtn');
const statusMessage = document.getElementById('statusMessage');

// Load saved settings (storage first, then config.json fallback)
function loadSettings() {
  chrome.storage.local.get(['orgId', 'directoryId', 'groupId', 'bearerToken'], async (result) => {
    if (result.orgId || result.directoryId || result.groupId || result.bearerToken) {
      if (result.orgId) orgIdInput.value = result.orgId;
      if (result.directoryId) directoryIdInput.value = result.directoryId;
      if (result.groupId) groupIdInput.value = result.groupId;
      if (result.bearerToken) bearerTokenInput.value = result.bearerToken;
      return;
    }

    // Nothing in storage — try to populate from config.json
    try {
      const url = chrome.runtime.getURL('config.json');
      const response = await fetch(url);
      const config = await response.json();
      if (config.orgId) orgIdInput.value = config.orgId;
      if (config.directoryId) directoryIdInput.value = config.directoryId;
      if (config.groupId) groupIdInput.value = config.groupId;
      if (config.bearerToken) bearerTokenInput.value = config.bearerToken;
      showStatus('Loaded from config.json. Click "Save Settings" to persist.', 'success');
    } catch (e) {
      // No config.json either — fields stay empty
    }
  });
}

// Save settings
form.addEventListener('submit', (e) => {
  e.preventDefault();

  const orgId = orgIdInput.value.trim();
  const directoryId = directoryIdInput.value.trim();
  const groupId = groupIdInput.value.trim();
  const bearerToken = bearerTokenInput.value.trim();

  // Validation
  if (!orgId || !directoryId || !groupId || !bearerToken) {
    showStatus('Please fill in all required fields (*)', 'error');
    return;
  }

  // Validate UUIDs (basic check)
  const uuidRegex = /^[a-z0-9]{8}-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{12}$/i;
  if (!uuidRegex.test(orgId)) {
    showStatus('Organization ID does not appear to be a valid UUID', 'error');
    return;
  }
  if (!uuidRegex.test(directoryId)) {
    showStatus('Directory ID does not appear to be a valid UUID', 'error');
    return;
  }
  if (!uuidRegex.test(groupId)) {
    showStatus('Group ID does not appear to be a valid UUID', 'error');
    return;
  }

  // Save to storage
  chrome.storage.local.set({
    orgId: orgId,
    directoryId: directoryId,
    groupId: groupId,
    bearerToken: bearerToken
  }, () => {
    showStatus('Settings saved successfully!', 'success');

    // Clear status after 5 seconds
    setTimeout(() => {
      statusMessage.className = 'status-message';
    }, 5000);
  });
});

// Load from config.json button
loadConfigBtn.addEventListener('click', async () => {
  try {
    const url = chrome.runtime.getURL('config.json');
    const response = await fetch(url);
    const config = await response.json();

    if (config.orgId) orgIdInput.value = config.orgId;
    if (config.directoryId) directoryIdInput.value = config.directoryId;
    if (config.groupId) groupIdInput.value = config.groupId;
    if (config.bearerToken) bearerTokenInput.value = config.bearerToken;

    showStatus('Loaded values from config.json. Click "Save Settings" to persist them.', 'success');
  } catch (e) {
    showStatus('Could not load config.json. File may be missing or invalid.', 'error');
  }
});

// Reset button
resetBtn.addEventListener('click', () => {
  if (confirm('Are you sure you want to clear all settings? This cannot be undone.')) {
    chrome.storage.local.remove(['orgId', 'directoryId', 'groupId', 'bearerToken'], () => {
      orgIdInput.value = '';
      directoryIdInput.value = '';
      groupIdInput.value = '';
      bearerTokenInput.value = '';
      showStatus('All settings cleared', 'success');
    });
  }
});

// Show status message
function showStatus(message, type) {
  statusMessage.textContent = message;
  statusMessage.className = `status-message ${type}`;
}
