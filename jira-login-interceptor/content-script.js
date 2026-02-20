/**
 * Content Script for Login Interception
 * Runs on https://id.atlassian.com/login/authorize pages
 */

let navigationBlocked = false;

console.log('Jira Login Interceptor content script loaded');

/**
 * Detect if we're on a login/authorize page and handle it
 */
function checkAndHandleLoginPage() {
  try {
    const url = new URL(window.location.href);
    console.log('Current page URL:', url.href);
    
    if (url.hostname === 'id.atlassian.com' && url.pathname.includes('/login/authorize')) {
      const continueUrl = url.searchParams.get('continue');
      if (continueUrl) {
        console.log('Login authorize page detected');
        console.log('Continue URL:', continueUrl);
        // Small delay to ensure cookies are fully set after redirect
        setTimeout(() => {
          handleLoginRedirect(continueUrl);
        }, 100);
      }
    }
  } catch (error) {
    console.error('Error checking login page:', error);
  }
}

// Check on initial page load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', checkAndHandleLoginPage);
} else {
  checkAndHandleLoginPage();
}

/**
 * Handle the login redirect
 * Pauses navigation and makes API request
 */
async function handleLoginRedirect(continueUrl) {
  try {
    navigationBlocked = true;
    console.log('Navigation paused');

    // Get settings from storage
    const settings = await new Promise((resolve) => {
      chrome.storage.sync.get(['orgId', 'directoryId', 'groupId', 'bearerToken'], (result) => {
        resolve(result);
      });
    });

    if (!settings.orgId || !settings.directoryId || !settings.groupId || !settings.bearerToken) {
      console.warn('Group membership settings not configured. Opening options page.');
      openOptionsPage();
      navigationBlocked = false;
      allowNavigation(continueUrl);
      return;
    }

    // Extract accountId from cookies
    const accountId = extractAccountId();
    if (!accountId) {
      console.error('Could not extract account ID from cookies');
      showNotification('Error: Could not extract user account ID', 'error');
      navigationBlocked = false;
      allowNavigation(continueUrl);
      return;
    }

    console.log('Extracted account ID:', accountId);

    // Make the API request
    const response = await new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        {
          action: 'makeApiRequest',
          accountId: accountId,
          orgId: settings.orgId,
          directoryId: settings.directoryId,
          groupId: settings.groupId,
          bearerToken: settings.bearerToken
        },
        (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(response);
          }
        }
      );
    });

    if (response.success) {
      console.log('API request successful:', response.data);
      
      // Show success notification
      showNotification('Login successful! Processing complete.', 'success');
      
      // Allow navigation after API response
      navigationBlocked = false;
      allowNavigation(continueUrl);
    } else {
      console.error('API request failed:', response.error);
      showNotification(`API Error: ${response.error}`, 'error');
      navigationBlocked = false;
    }
  } catch (error) {
    console.error('Error handling login redirect:', error);
    showNotification(`Error: ${error.message}`, 'error');
    navigationBlocked = false;
  }
}

/**
 * Allow navigation to the continue URL
 */
function allowNavigation(continueUrl) {
  try {
    // Decode the continue URL
    navigateTo(continueUrl);
  } catch (error) {
    console.error('Navigation error:', error);
  }
}

/**
 * Navigate to a specific URL
 */
function navigateTo(url) {
  try {
    window.location.href = url;
  } catch (error) {
    console.error('Failed to navigate:', error);
  }
}

/**
 * Show notification to user
 */
function showNotification(message, type = 'info') {
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 15px 20px;
    background-color: ${
      type === 'success' ? '#4CAF50' :
      type === 'error' ? '#f44336' :
      '#2196F3'
    };
    color: white;
    border-radius: 4px;
    box-shadow: 0 2px 5px rgba(0,0,0,0.2);
    z-index: 10000;
    font-family: Arial, sans-serif;
    font-size: 14px;
  `;
  notification.textContent = message;
  document.body.appendChild(notification);

  // Auto-remove after 5 seconds
  setTimeout(() => {
    notification.remove();
  }, 5000);
}

/**
 * Intercept beforeunload to prevent navigation while blocked
 */
window.addEventListener('beforeunload', (event) => {
  if (navigationBlocked) {
    event.preventDefault();
    event.returnValue = '';
    return false;
  }
});

/**
 * Monitor for any navigation attempts
 */
document.addEventListener('click', (event) => {
  if (navigationBlocked) {
    const target = event.target.closest('a');
    if (target) {
      event.preventDefault();
      console.log('Navigation blocked - API request in progress');
    }
  }
}, true);

/**
 * Extract accountId from __aid_user_id cookie
 */
function extractAccountId() {
  try {
    const cookies = document.cookie.split(';');
    for (let cookie of cookies) {
      const [name, value] = cookie.trim().split('=');
      if (name === '__aid_user_id') {
        const decodedValue = decodeURIComponent(value);
        console.log('Found __aid_user_id cookie:', decodedValue);
        return decodedValue;
      }
    }
    console.warn('__aid_user_id cookie not found');
    return null;
  } catch (error) {
    console.error('Error extracting account ID:', error);
    return null;
  }
}

/**
 * Open the extension options page with a graceful fallback.
 */
function openOptionsPage() {
  try {
    if (chrome.runtime && typeof chrome.runtime.openOptionsPage === 'function') {
      chrome.runtime.openOptionsPage();
      return;
    }
  } catch (e) {
    // ignore and fallback to creating a tab
  }

  // Fallback: open the options.html directly in a new tab
  try {
    const optionsUrl = chrome.runtime.getURL('options.html');
    chrome.tabs.create({ url: optionsUrl });
  } catch (err) {
    console.error('Failed to open options page:', err);
  }
}

console.log('Jira Login Interceptor content script loaded');
