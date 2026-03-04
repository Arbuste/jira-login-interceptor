/**
 * Popup script for extension
 */

document.addEventListener('DOMContentLoaded', () => {
  checkStatus();
  setupEventListeners();
});

async function checkStatus() {
  const result = await loadSettings();
  const statusDiv = document.getElementById('status');

  if (result.forgeEndpointUrl && result.apiKey) {
    statusDiv.className = 'status active';
    const source = result.managedPolicy ? ' (managed by IT policy)' : '';
    statusDiv.textContent = `\u2713 Extension configured and active${source}`;
  } else {
    statusDiv.className = 'status inactive';
    statusDiv.textContent = '\u2717 Extension not configured. Please set up your Forge endpoint and API key.';
  }
}

function setupEventListeners() {
  document.getElementById('configBtn').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  document.getElementById('openOptions').addEventListener('click', (e) => {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
  });
}
