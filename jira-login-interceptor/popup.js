/**
 * Popup script for extension
 */

document.addEventListener('DOMContentLoaded', () => {
  checkStatus();
  setupEventListeners();
});

function checkStatus() {
  chrome.storage.sync.get(['orgId', 'directoryId', 'groupId', 'bearerToken'], (result) => {
    const statusDiv = document.getElementById('status');
    
    if (result.orgId && result.directoryId && result.groupId && result.bearerToken) {
      statusDiv.className = 'status active';
      statusDiv.textContent = '✓ Extension configured and active';
    } else {
      statusDiv.className = 'status inactive';
      statusDiv.textContent = '✗ Extension not configured. Please set up your group membership settings.';
    }
  });
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
