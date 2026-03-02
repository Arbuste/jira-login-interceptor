/**
 * Content Script for Login Interception
 * Runs on https://id.atlassian.com/login/authorize pages
 * Injected at document_start.
 *
 * navigation-blocker.js (MAIN world) runs first to intercept
 * location.assign/replace. This script handles the interstitial UI.
 */

let navigationBlocked = true; // blocked from the start — only unblocked on user click
let overlayElement = null;
let loginInProgress = false;

console.log('Jira Login Interceptor content script loaded');

// MutationObserver to remove meta refresh tags and block form submissions
const jliObserver = new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    for (const node of mutation.addedNodes) {
      if (node.nodeType !== Node.ELEMENT_NODE) continue;
      if (node.tagName === 'META' && node.httpEquiv && node.httpEquiv.toLowerCase() === 'refresh') {
        node.remove();
      }
      if (node.tagName === 'FORM') {
        node.addEventListener('submit', (e) => { if (navigationBlocked) e.preventDefault(); }, true);
      }
    }
  }
});
jliObserver.observe(document.documentElement || document, { childList: true, subtree: true });

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

    const textCol = document.createElement('div');
    textCol.style.cssText = 'display: flex; flex-direction: column; gap: 4px; min-width: 0;';

    const label = document.createElement('span');
    label.className = 'jli-step-label';
    label.style.cssText = 'font-size: 14px; color: #484f58; transition: color 0.3s ease;';
    label.textContent = step.label;

    const detail = document.createElement('div');
    detail.className = 'jli-step-detail';
    detail.style.cssText = `
      font-size: 12px; color: #8b949e; display: none;
      font-family: 'Courier New', monospace; word-break: break-all;
      background: #0d1117; border: 1px solid #30363d; border-radius: 4px;
      padding: 6px 8px; margin-top: 2px; white-space: pre-wrap;
    `;

    textCol.appendChild(label);
    textCol.appendChild(detail);
    row.appendChild(icon);
    row.appendChild(textCol);
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

  // Manual continue button (hidden by default, shown on error)
  const continueBtn = document.createElement('button');
  continueBtn.id = 'jli-continue-btn';
  continueBtn.textContent = 'Continue to destination';
  continueBtn.style.cssText = `
    display: none; margin-top: 20px; padding: 10px 24px; font-size: 14px;
    font-weight: 500; color: #fff; background: #21262d; border: 1px solid #30363d;
    border-radius: 6px; cursor: pointer; transition: background 0.2s ease;
    width: 100%; text-align: center;
  `;
  continueBtn.addEventListener('mouseenter', () => { continueBtn.style.background = '#30363d'; });
  continueBtn.addEventListener('mouseleave', () => { continueBtn.style.background = '#21262d'; });
  card.appendChild(continueBtn);

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
 * @param {string} [detail] - optional detail text shown inline under the step (for errors/warnings)
 */
function updateInterstitialStep(stepNumber, status, message, detail) {
  const row = document.getElementById(`jli-step-${stepNumber}`);
  if (!row) return;

  const icon = row.querySelector('.jli-step-icon');
  const label = row.querySelector('.jli-step-label');
  const detailEl = row.querySelector('.jli-step-detail');
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

  // Show inline detail under the step
  if (detailEl) {
    if (detail) {
      detailEl.textContent = detail;
      detailEl.style.display = 'block';
      if (status === 'error') {
        detailEl.style.borderColor = '#da3633';
        detailEl.style.color = '#f85149';
      } else if (status === 'warning') {
        detailEl.style.borderColor = '#9e6a03';
        detailEl.style.color = '#d29922';
      }
    } else {
      detailEl.style.display = 'none';
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
        // Don't block yet — check membership first
        setTimeout(async () => {
          try {
            const alreadyMember = await checkMembershipBeforeBlocking();
            if (alreadyMember) {
              console.log('User already in group — bypassing interstitial');
              releaseNavigation();
              navigateTo(continueUrl);
              return;
            }
          } catch (e) {
            console.warn('Pre-check failed, showing interstitial:', e);
          }
          // User is not in the group (or check failed) — block and show interstitial
          navigationBlocked = true;
          window.stop();
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
 * Release all navigation blocking so the page can redirect normally.
 */
function releaseNavigation() {
  navigationBlocked = false;
  jliObserver.disconnect();
  window.dispatchEvent(new Event('jli-unblock-navigation'));
}

/**
 * Quick membership check before showing the interstitial.
 * If the user is already in the group, returns true so we can bypass entirely.
 * @returns {Promise<boolean>}
 */
async function checkMembershipBeforeBlocking() {
  const settings = await loadSettings();
  if (!settings.orgId || !settings.directoryId || !settings.groupId || !settings.bearerToken) {
    return false; // can't check — let the interstitial handle the error
  }

  const accountId = extractAccountId();
  if (!accountId) {
    return false; // can't check — let the interstitial handle the error
  }

  const response = await sendMessageWithTimeout({
    action: 'verifyMembership',
    accountId,
    orgId: settings.orgId,
    directoryId: settings.directoryId,
    groupId: settings.groupId,
    bearerToken: settings.bearerToken
  }, 5000); // short timeout — don't delay the user

  return response && response.isMember === true;
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

    const STEP_DELAY = 2000; // minimum time each step stays visible
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));

    // Show the interstitial overlay immediately
    createInterstitialOverlay();
    updateInterstitialStep(1, 'active', 'Detecting login...');

    // Get settings (config.json first, then chrome.storage.local fallback)
    const settings = await loadSettings();

    if (!settings.orgId || !settings.directoryId || !settings.groupId || !settings.bearerToken) {
      const missing = ['orgId', 'directoryId', 'groupId', 'bearerToken'].filter(k => !settings[k]);
      console.warn('Group membership settings not configured. Opening options page.');
      updateInterstitialStep(1, 'error', 'Extension not configured. Opening settings...',
        `Missing fields: ${missing.join(', ')}`);
      openOptionsPage();
      showContinueButton(continueUrl);
      return;
    }

    await wait(STEP_DELAY);
    updateInterstitialStep(1, 'completed');

    // Step 2: Extract account ID
    updateInterstitialStep(2, 'active', 'Extracting account ID...');

    const accountId = extractAccountId();

    if (!accountId) {
      console.error('Could not extract account ID from cookies');
      const cookieNames = document.cookie.split(';').map(c => c.trim().split('=')[0]).filter(Boolean);
      updateInterstitialStep(2, 'error', 'Could not extract user account ID.',
        `Cookie "__aid_user_id" not found.\nAvailable cookies: ${cookieNames.length ? cookieNames.join(', ') : '(none)'}`);
      showContinueButton(continueUrl);
      return;
    }

    await wait(STEP_DELAY);
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
      updateInterstitialStep(3, 'error', 'Failed to add to group.',
        `Error: ${response.error}\nOrg: ${settings.orgId}\nDirectory: ${settings.directoryId}\nGroup: ${settings.groupId}\nAccount: ${accountId}`);
      showContinueButton(continueUrl);
      return;
    }

    await wait(STEP_DELAY);
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
      await wait(STEP_DELAY);
      updateInterstitialStep(4, 'completed', 'Membership confirmed!');
    } else {
      console.warn('Could not confirm membership');
      updateInterstitialStep(4, 'warning', 'Could not confirm membership.',
        `Polled 5 times with 2s delay. The user may not yet appear in the group.\nAccount: ${accountId}\nGroup: ${settings.groupId}`);
      showContinueButton(continueUrl);
      return;
    }

    // Step 5: Wait with countdown then redirect
    updateInterstitialStep(5, 'active', 'Redirecting to your destination...');
    await wait(STEP_DELAY);
    updateInterstitialStep(5, 'completed', 'All done!');
    showContinueButton(continueUrl);
  } catch (error) {
    console.error('Error handling login redirect:', error);
    // Mark whichever step is currently active as errored
    for (let i = 1; i <= STEPS.length; i++) {
      const row = document.getElementById(`jli-step-${i}`);
      if (row) {
        const icon = row.querySelector('.jli-step-icon');
        if (icon && icon.querySelector('svg[style*="jli-spin"]')) {
          updateInterstitialStep(i, 'error', `Unexpected error at step ${i}.`,
            `${error.message}\n${error.stack || ''}`);
          break;
        }
      }
    }
    showContinueButton(continueUrl);
  } finally {
    loginInProgress = false;
  }
}

/**
 * Show the continue button with a 30-second countdown, then auto-redirect.
 * The user can click anytime to proceed immediately.
 * @param {string} continueUrl - The URL to navigate to when the button is clicked
 */
function showContinueButton(continueUrl) {
  const btn = document.getElementById('jli-continue-btn');
  if (!btn) return;

  let seconds = 30;
  btn.textContent = `Continue to destination (${seconds}s)`;
  btn.style.display = 'block';

  const countdown = setInterval(() => {
    seconds--;
    btn.textContent = `Continue to destination (${seconds}s)`;
    if (seconds <= 0) {
      clearInterval(countdown);
      navigationBlocked = false;
      allowNavigation(continueUrl);
    }
  }, 1000);

  btn.addEventListener('click', () => {
    clearInterval(countdown);
    navigationBlocked = false;
    allowNavigation(continueUrl);
  }, { once: true });
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
    releaseNavigation();
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
