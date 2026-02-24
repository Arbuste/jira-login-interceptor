/**
 * Content Script for Login Interception
 * Runs on https://id.atlassian.com/login/authorize pages
 */

let navigationBlocked = false;
let overlayElement = null;
let loginInProgress = false;

console.log('Jira Login Interceptor content script loaded');

/**
 * Step definitions for the interstitial overlay
 */
const STEPS = [
  { label: 'Login detected' },
  { label: 'Account ID extracted' },
  { label: 'Adding to group' },
  { label: 'Verifying membership' },
  { label: 'Redirecting' }
];

/**
 * Create and inject the full-page interstitial overlay
 */
function createInterstitialOverlay() {
  if (overlayElement) return overlayElement;

  const overlay = document.createElement('div');
  overlay.id = 'jli-interstitial';
  overlay.style.cssText = `
    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    background: #0d1117; color: #e6edf3; z-index: 999999;
    display: flex; align-items: center; justify-content: center;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
    flex-direction: column;
  `;

  const card = document.createElement('div');
  card.style.cssText = `
    background: #161b22; border: 1px solid #30363d; border-radius: 12px;
    padding: 40px 48px; max-width: 480px; width: 90%; box-shadow: 0 8px 32px rgba(0,0,0,0.4);
  `;

  // Title
  const title = document.createElement('h2');
  title.textContent = 'Setting up your access';
  title.style.cssText = 'margin: 0 0 8px 0; font-size: 22px; font-weight: 600; color: #e6edf3;';
  card.appendChild(title);

  // Description
  const desc = document.createElement('p');
  desc.textContent = 'Please wait while we configure your group membership.';
  desc.style.cssText = 'margin: 0 0 28px 0; font-size: 14px; color: #8b949e;';
  card.appendChild(desc);

  // Steps list
  const stepsList = document.createElement('div');
  stepsList.id = 'jli-steps';
  stepsList.style.cssText = 'display: flex; flex-direction: column; gap: 14px; margin-bottom: 28px;';

  STEPS.forEach((step, i) => {
    const row = document.createElement('div');
    row.id = `jli-step-${i + 1}`;
    row.style.cssText = 'display: flex; align-items: center; gap: 12px;';

    const icon = document.createElement('div');
    icon.className = 'jli-step-icon';
    icon.style.cssText = `
      width: 28px; height: 28px; border-radius: 50%; display: flex;
      align-items: center; justify-content: center; font-size: 13px;
      font-weight: 600; flex-shrink: 0; transition: all 0.3s ease;
      background: #21262d; color: #484f58; border: 2px solid #30363d;
    `;
    icon.textContent = i + 1;

    const label = document.createElement('span');
    label.className = 'jli-step-label';
    label.style.cssText = 'font-size: 14px; color: #484f58; transition: color 0.3s ease;';
    label.textContent = step.label;

    row.appendChild(icon);
    row.appendChild(label);
    stepsList.appendChild(row);
  });

  card.appendChild(stepsList);

  // Progress bar
  const progressTrack = document.createElement('div');
  progressTrack.style.cssText = `
    width: 100%; height: 4px; background: #21262d; border-radius: 2px;
    overflow: hidden; margin-bottom: 20px;
  `;
  const progressBar = document.createElement('div');
  progressBar.id = 'jli-progress';
  progressBar.style.cssText = `
    width: 0%; height: 100%; background: linear-gradient(90deg, #238636, #2ea043);
    border-radius: 2px; transition: width 0.5s ease;
  `;
  progressTrack.appendChild(progressBar);
  card.appendChild(progressTrack);

  // Status message area
  const statusMsg = document.createElement('div');
  statusMsg.id = 'jli-status';
  statusMsg.style.cssText = 'font-size: 13px; color: #8b949e; text-align: center; min-height: 18px;';
  statusMsg.textContent = 'This usually takes a few seconds';
  card.appendChild(statusMsg);

  overlay.appendChild(card);
  document.documentElement.appendChild(overlay);
  overlayElement = overlay;
  return overlay;
}

/**
 * Update a step in the interstitial overlay.
 * @param {number} stepNumber - 1-based step number
 * @param {'active'|'completed'|'warning'|'error'} status
 * @param {string} [message] - optional status message to display
 */
function updateInterstitialStep(stepNumber, status, message) {
  const row = document.getElementById(`jli-step-${stepNumber}`);
  if (!row) return;

  const icon = row.querySelector('.jli-step-icon');
  const label = row.querySelector('.jli-step-label');
  const progress = document.getElementById('jli-progress');
  const statusMsg = document.getElementById('jli-status');

  if (status === 'active') {
    icon.textContent = '';
    icon.style.background = '#1f6feb';
    icon.style.border = '2px solid #388bfd';
    icon.style.color = '#fff';
    // Spinner via box-shadow trick: just show a pulsing dot
    icon.innerHTML = `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" style="animation: jli-spin 1s linear infinite;">
      <circle cx="7" cy="7" r="5.5" stroke="white" stroke-width="2" stroke-dasharray="20 12" stroke-linecap="round"/>
    </svg>`;
    label.style.color = '#e6edf3';
    label.style.fontWeight = '500';
    // Inject keyframes if not already present
    if (!document.getElementById('jli-keyframes')) {
      const style = document.createElement('style');
      style.id = 'jli-keyframes';
      style.textContent = '@keyframes jli-spin { to { transform: rotate(360deg); } }';
      document.head.appendChild(style);
    }
  } else if (status === 'completed') {
    icon.innerHTML = `<svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M3 7.5L5.5 10L11 4" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;
    icon.style.background = '#238636';
    icon.style.border = '2px solid #2ea043';
    icon.style.color = '#fff';
    label.style.color = '#7ee787';
    label.style.fontWeight = '400';
  } else if (status === 'warning') {
    icon.innerHTML = `<svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M7 4V8" stroke="white" stroke-width="2" stroke-linecap="round"/>
      <circle cx="7" cy="10.5" r="1" fill="white"/>
    </svg>`;
    icon.style.background = '#9e6a03';
    icon.style.border = '2px solid #d29922';
    icon.style.color = '#fff';
    label.style.color = '#d29922';
    label.style.fontWeight = '400';
  } else if (status === 'error') {
    icon.innerHTML = `<svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M4 4L10 10M10 4L4 10" stroke="white" stroke-width="2" stroke-linecap="round"/>
    </svg>`;
    icon.style.background = '#da3633';
    icon.style.border = '2px solid #f85149';
    icon.style.color = '#fff';
    label.style.color = '#f85149';
    label.style.fontWeight = '400';
  }

  // Update progress bar
  if (progress) {
    const pct = status === 'error'
      ? ((stepNumber - 1) / STEPS.length) * 100
      : (stepNumber / STEPS.length) * 100;
    progress.style.width = `${pct}%`;
    if (status === 'error') {
      progress.style.background = 'linear-gradient(90deg, #da3633, #f85149)';
    }
  }

  // Update status message
  if (statusMsg && message) {
    statusMsg.textContent = message;
    if (status === 'error') {
      statusMsg.style.color = '#f85149';
    } else if (status === 'warning') {
      statusMsg.style.color = '#d29922';
    }
  }
}

/**
 * Detect if we're on a login/authorize page and handle it
 */
function checkAndHandleLoginPage() {
  try {
    const url = new URL(window.location.href);

    if (url.hostname === 'id.atlassian.com' && url.pathname.includes('/login/authorize')) {
      const continueUrl = url.searchParams.get('continue');
      if (continueUrl) {
        console.log('Login authorize page detected');
        // Block navigation immediately to avoid race condition
        navigationBlocked = true;
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
 * Send a message to the service worker with a timeout.
 * @param {object} message - The message to send
 * @param {number} [timeoutMs=20000] - Timeout in milliseconds
 * @returns {Promise<any>} The response from the service worker
 */
function sendMessageWithTimeout(message, timeoutMs = 20000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Service worker did not respond')), timeoutMs);
    chrome.runtime.sendMessage(message, (response) => {
      clearTimeout(timer);
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(response);
      }
    });
  });
}

/**
 * Handle the login redirect
 * Pauses navigation and makes API request
 */
async function handleLoginRedirect(continueUrl) {
  if (loginInProgress) return;
  loginInProgress = true;
  try {
    navigationBlocked = true;

    // Show the interstitial overlay immediately
    createInterstitialOverlay();
    updateInterstitialStep(1, 'active', 'Detecting login...');

    // Get settings (config.json first, then chrome.storage.local fallback)
    const settings = await loadSettings();

    if (!settings.orgId || !settings.directoryId || !settings.groupId || !settings.bearerToken) {
      console.warn('Group membership settings not configured. Opening options page.');
      updateInterstitialStep(1, 'error', 'Extension not configured. Opening settings...');
      openOptionsPage();
      await new Promise((r) => setTimeout(r, 2000));
      navigationBlocked = false;
      allowNavigation(continueUrl);
      return;
    }

    updateInterstitialStep(1, 'completed');

    // Step 2: Extract account ID
    updateInterstitialStep(2, 'active', 'Extracting account ID...');

    const accountId = extractAccountId();
    if (!accountId) {
      console.error('Could not extract account ID from cookies');
      updateInterstitialStep(2, 'error', 'Could not extract user account ID. Redirecting...');
      await new Promise((r) => setTimeout(r, 3000));
      navigationBlocked = false;
      allowNavigation(continueUrl);
      return;
    }

    updateInterstitialStep(2, 'completed');

    // Step 3: Add to group
    updateInterstitialStep(3, 'active', 'Adding your account to the group...');

    const response = await sendMessageWithTimeout({
      action: 'makeApiRequest',
      accountId: accountId,
      orgId: settings.orgId,
      directoryId: settings.directoryId,
      groupId: settings.groupId,
      bearerToken: settings.bearerToken
    });

    if (!response.success) {
      console.error('API request failed:', response.error);
      updateInterstitialStep(3, 'error', `Failed to add to group: ${response.error}. Redirecting...`);
      await new Promise((r) => setTimeout(r, 3000));
      navigationBlocked = false;
      allowNavigation(continueUrl);
      return;
    }

    updateInterstitialStep(3, 'completed');

    // Step 4: Verify membership
    updateInterstitialStep(4, 'active', 'Verifying group membership...');

    const verified = await verifyGroupMembership(
      accountId,
      settings.orgId,
      settings.directoryId,
      settings.groupId,
      settings.bearerToken
    );

    if (verified) {
      updateInterstitialStep(4, 'completed', 'Membership confirmed!');
    } else {
      console.warn('Could not confirm membership — redirecting anyway');
      updateInterstitialStep(4, 'warning', 'Could not confirm membership. Redirecting anyway...');
    }

    // Step 5: Redirect
    updateInterstitialStep(5, 'active', 'Redirecting to your destination...');
    await new Promise((r) => setTimeout(r, 500));
    updateInterstitialStep(5, 'completed', 'All done! Redirecting now...');
    await new Promise((r) => setTimeout(r, 300));

    navigationBlocked = false;
    allowNavigation(continueUrl);
  } catch (error) {
    console.error('Error handling login redirect:', error);
    // Mark whichever step is currently active as errored
    for (let i = 1; i <= STEPS.length; i++) {
      const row = document.getElementById(`jli-step-${i}`);
      if (row) {
        const icon = row.querySelector('.jli-step-icon');
        if (icon && icon.querySelector('svg[style*="jli-spin"]')) {
          updateInterstitialStep(i, 'error', `Error: ${error.message}. Redirecting...`);
          break;
        }
      }
    }
    await new Promise((r) => setTimeout(r, 3000));
    navigationBlocked = false;
    allowNavigation(continueUrl);
  } finally {
    loginInProgress = false;
  }
}

/**
 * Allow navigation to the continue URL
 */
function allowNavigation(continueUrl) {
  try {
    navigateTo(continueUrl);
  } catch (error) {
    console.error('Navigation error:', error);
  }
}

/**
 * Navigate to a specific URL after validating it is a trusted Atlassian domain.
 */
function navigateTo(url) {
  try {
    const parsed = new URL(url);
    const allowed = ['.atlassian.com', '.atlassian.net'];
    const isAllowed = allowed.some(domain => parsed.hostname === domain.slice(1) || parsed.hostname.endsWith(domain));
    if (parsed.protocol !== 'https:' || !isAllowed) {
      console.error('Blocked redirect to untrusted URL:', url);
      return;
    }
    window.location.href = url;
  } catch (error) {
    console.error('Failed to navigate:', error);
  }
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
 * Verify that the user is actually a member of the target group.
 * Polls the Atlassian Admin API (via service worker) up to a few times
 * with a delay between attempts to account for eventual consistency.
 *
 * @returns {Promise<boolean>} true if membership confirmed
 */
async function verifyGroupMembership(accountId, orgId, directoryId, groupId, bearerToken) {
  const MAX_ATTEMPTS = 5;
  const DELAY_MS = 2000;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const response = await sendMessageWithTimeout({
        action: 'verifyMembership',
        accountId,
        orgId,
        directoryId,
        groupId,
        bearerToken
      });

      if (response.isMember) {
        return true;
      }
    } catch (error) {
      console.warn(`Verification attempt ${attempt} failed:`, error);
    }

    if (attempt < MAX_ATTEMPTS) {
      await new Promise((r) => setTimeout(r, DELAY_MS));
    }
  }

  return false;
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
