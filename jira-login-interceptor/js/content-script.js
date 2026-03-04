/**
 * Content Script for Login Interception
 * Runs on https://id.atlassian.com/login/authorize pages
 * Injected at document_start.
 *
 * navigation-blocker.js (MAIN world) runs first to intercept
 * location.assign/replace. This script handles the interstitial UI.
 * interstitial.css is loaded via the manifest.
 */

let navigationBlocked = true;
let overlayElement = null;
let loginInProgress = false;

console.log('Jira Login Interceptor content script loaded');

// ── Navigation blocking helpers ─────────────────────────────────────

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

window.addEventListener('beforeunload', (event) => {
  if (navigationBlocked) {
    event.preventDefault();
    event.returnValue = '';
    return false;
  }
});

document.addEventListener('click', (event) => {
  if (navigationBlocked && event.target.closest('a')) {
    event.preventDefault();
  }
}, true);

function releaseNavigation() {
  navigationBlocked = false;
  jliObserver.disconnect();
  window.dispatchEvent(new Event('jli-unblock-navigation'));
}

// ── Step definitions ────────────────────────────────────────────────

const STEPS = [
  { label: 'Login detected' },
  { label: 'Account ID extracted' },
  { label: 'Adding to group' },
  { label: 'Verifying membership' },
  { label: 'Redirecting' }
];

// ── SVG icons ───────────────────────────────────────────────────────

const SVG_SPINNER = `<svg class="jli-spinner" width="14" height="14" viewBox="0 0 14 14" fill="none">
  <circle cx="7" cy="7" r="5.5" stroke="white" stroke-width="2" stroke-dasharray="20 12" stroke-linecap="round"/>
</svg>`;

const SVG_CHECK = `<svg width="14" height="14" viewBox="0 0 14 14" fill="none">
  <path d="M3 7.5L5.5 10L11 4" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

const SVG_WARN = `<svg width="14" height="14" viewBox="0 0 14 14" fill="none">
  <path d="M7 4V8" stroke="white" stroke-width="2" stroke-linecap="round"/>
  <circle cx="7" cy="10.5" r="1" fill="white"/>
</svg>`;

const SVG_ERROR = `<svg width="14" height="14" viewBox="0 0 14 14" fill="none">
  <path d="M4 4L10 10M10 4L4 10" stroke="white" stroke-width="2" stroke-linecap="round"/>
</svg>`;

// ── Interstitial overlay ────────────────────────────────────────────

function createInterstitialOverlay() {
  if (overlayElement) return overlayElement;

  const overlay = document.createElement('div');
  overlay.id = 'jli-interstitial';

  const card = document.createElement('div');
  card.className = 'jli-card';

  const title = document.createElement('h2');
  title.className = 'jli-title';
  title.textContent = 'Setting up your access';
  card.appendChild(title);

  const desc = document.createElement('p');
  desc.className = 'jli-desc';
  desc.textContent = 'Please wait while we configure your group membership.';
  card.appendChild(desc);

  const stepsList = document.createElement('div');
  stepsList.id = 'jli-steps';

  STEPS.forEach((step, i) => {
    const row = document.createElement('div');
    row.id = `jli-step-${i + 1}`;
    row.className = 'jli-step';

    const icon = document.createElement('div');
    icon.className = 'jli-step-icon';
    icon.textContent = i + 1;

    const textCol = document.createElement('div');
    textCol.className = 'jli-step-text';

    const label = document.createElement('span');
    label.className = 'jli-step-label';
    label.textContent = step.label;

    const detail = document.createElement('div');
    detail.className = 'jli-step-detail';

    textCol.appendChild(label);
    textCol.appendChild(detail);
    row.appendChild(icon);
    row.appendChild(textCol);
    stepsList.appendChild(row);
  });

  card.appendChild(stepsList);

  const progressTrack = document.createElement('div');
  progressTrack.className = 'jli-progress-track';
  const progressBar = document.createElement('div');
  progressBar.id = 'jli-progress';
  progressTrack.appendChild(progressBar);
  card.appendChild(progressTrack);

  const statusMsg = document.createElement('div');
  statusMsg.id = 'jli-status';
  statusMsg.textContent = 'This usually takes a few seconds';
  card.appendChild(statusMsg);

  const continueBtn = document.createElement('button');
  continueBtn.id = 'jli-continue-btn';
  continueBtn.textContent = 'Continue to destination';
  card.appendChild(continueBtn);

  overlay.appendChild(card);
  document.documentElement.appendChild(overlay);
  overlayElement = overlay;
  return overlay;
}

// ── Step updates ────────────────────────────────────────────────────

/**
 * @param {number} stepNumber  1-based
 * @param {'active'|'completed'|'warning'|'error'} status
 * @param {string} [message]   status bar text
 * @param {string} [detail]    diagnostic detail shown under the step
 */
function updateInterstitialStep(stepNumber, status, message, detail) {
  const row = document.getElementById(`jli-step-${stepNumber}`);
  if (!row) return;

  const icon = row.querySelector('.jli-step-icon');
  const detailEl = row.querySelector('.jli-step-detail');
  const progress = document.getElementById('jli-progress');
  const statusMsg = document.getElementById('jli-status');

  // Reset row class to base + new status
  row.className = `jli-step ${status}`;

  // Reset icon class and content
  icon.className = `jli-step-icon ${status}`;
  if (status === 'active') {
    icon.innerHTML = SVG_SPINNER;
  } else if (status === 'completed') {
    icon.innerHTML = SVG_CHECK;
  } else if (status === 'warning') {
    icon.innerHTML = SVG_WARN;
  } else if (status === 'error') {
    icon.innerHTML = SVG_ERROR;
  }

  // Progress bar
  if (progress) {
    const pct = status === 'error'
      ? ((stepNumber - 1) / STEPS.length) * 100
      : (stepNumber / STEPS.length) * 100;
    progress.style.width = `${pct}%`;
    progress.className = status === 'error' ? 'error' : '';
  }

  // Status message
  if (statusMsg && message) {
    statusMsg.textContent = message;
    statusMsg.className = (status === 'error' || status === 'warning') ? status : '';
  }

  // Inline detail
  if (detailEl) {
    if (detail) {
      detailEl.textContent = detail;
      detailEl.classList.add('visible');
    } else {
      detailEl.textContent = '';
      detailEl.classList.remove('visible');
    }
  }
}

// ── Page detection ──────────────────────────────────────────────────

function checkAndHandleLoginPage() {
  try {
    const url = new URL(window.location.href);

    if (url.hostname === 'id.atlassian.com' && url.pathname.includes('/login/authorize')) {
      const continueUrl = url.searchParams.get('continue');
      if (continueUrl) {
        console.log('Login authorize page detected');
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

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', checkAndHandleLoginPage);
} else {
  checkAndHandleLoginPage();
}

// ── Service worker messaging ────────────────────────────────────────

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

// ── Pre-check membership ────────────────────────────────────────────

async function checkMembershipBeforeBlocking() {
  const settings = await loadSettings();
  if (!settings.forgeEndpointUrl || !settings.apiKey) {
    return false;
  }

  const accountId = extractAccountId();
  if (!accountId) {
    return false;
  }

  const response = await sendMessageWithTimeout({
    action: 'verifyMembership',
    accountId,
    forgeEndpointUrl: settings.forgeEndpointUrl,
    apiKey: settings.apiKey
  }, 5000);

  return response && response.isMember === true;
}

// ── Main interstitial flow ──────────────────────────────────────────

async function handleLoginRedirect(continueUrl) {
  if (loginInProgress) return;
  loginInProgress = true;

  const STEP_DELAY = 2000;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  try {
    navigationBlocked = true;

    createInterstitialOverlay();
    updateInterstitialStep(1, 'active', 'Detecting login...');

    // Step 1: Load settings
    const settings = await loadSettings();

    if (!settings.forgeEndpointUrl || !settings.apiKey) {
      const missing = ['forgeEndpointUrl', 'apiKey'].filter(k => !settings[k]);
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
      const cookieNames = document.cookie.split(';').map(c => c.trim().split('=')[0]).filter(Boolean);
      const hasAtlassianCookies = cookieNames.some(n => n.startsWith('__aid') || n.startsWith('atlassian') || n.startsWith('cloud.session'));
      const hint = hasAtlassianCookies
        ? 'The login flow did not set the expected cookie. Your SSO/IdP may be bypassing the standard Atlassian ID authorize step.'
        : 'No Atlassian cookies found. Your organization may use an external Identity Provider (SAML/OIDC) that redirects through a different login flow, bypassing id.atlassian.com.';
      updateInterstitialStep(2, 'error', 'Could not extract user account ID.',
        `Cookie "__aid_user_id" not found. ${hint}\nAvailable cookies: ${cookieNames.length ? cookieNames.join(', ') : '(none)'}`);
      showContinueButton(continueUrl);
      return;
    }

    await wait(STEP_DELAY);
    updateInterstitialStep(2, 'completed');

    // Step 3: Add to group
    updateInterstitialStep(3, 'active', 'Adding your account to the group...');
    const response = await sendMessageWithTimeout({
      action: 'makeApiRequest',
      accountId,
      forgeEndpointUrl: settings.forgeEndpointUrl,
      apiKey: settings.apiKey
    });

    if (!response.success) {
      updateInterstitialStep(3, 'error', 'Failed to add to group.',
        `Error: ${response.error}\nEndpoint: ${settings.forgeEndpointUrl}\nAccount: ${accountId}`);
      showContinueButton(continueUrl);
      return;
    }

    await wait(STEP_DELAY);
    updateInterstitialStep(3, 'completed');

    // Step 4: Verify membership
    updateInterstitialStep(4, 'active', 'Verifying group membership...');
    const verified = await verifyGroupMembership(
      accountId, settings.forgeEndpointUrl, settings.apiKey
    );

    if (verified) {
      await wait(STEP_DELAY);
      updateInterstitialStep(4, 'completed', 'Membership confirmed!');
    } else {
      updateInterstitialStep(4, 'warning', 'Could not confirm membership.',
        `Polled 5 times with 2s delay. The user may not yet appear in the group.\nAccount: ${accountId}`);
      showContinueButton(continueUrl);
      return;
    }

    // Step 5: Done
    updateInterstitialStep(5, 'active', 'Redirecting to your destination...');
    await wait(STEP_DELAY);
    updateInterstitialStep(5, 'completed', 'All done!');
    showContinueButton(continueUrl);

  } catch (error) {
    console.error('Error handling login redirect:', error);
    for (let i = 1; i <= STEPS.length; i++) {
      const row = document.getElementById(`jli-step-${i}`);
      if (row && row.classList.contains('active')) {
        updateInterstitialStep(i, 'error', `Unexpected error at step ${i}.`,
          `${error.message}\n${error.stack || ''}`);
        break;
      }
    }
    showContinueButton(continueUrl);
  } finally {
    loginInProgress = false;
  }
}

// ── Continue button ─────────────────────────────────────────────────

function showContinueButton(continueUrl) {
  const btn = document.getElementById('jli-continue-btn');
  if (!btn) return;

  let seconds = 30;
  btn.textContent = `Continue to destination (${seconds}s)`;
  btn.classList.add('visible');

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

// ── Navigation ──────────────────────────────────────────────────────

function allowNavigation(continueUrl) {
  try {
    navigateTo(continueUrl);
  } catch (error) {
    console.error('Navigation error:', error);
  }
}

function navigateTo(url) {
  try {
    const parsed = new URL(url);
    const allowed = ['.atlassian.com', '.atlassian.net'];
    const isAllowed = allowed.some(d => parsed.hostname === d.slice(1) || parsed.hostname.endsWith(d));
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

// ── Utilities ───────────────────────────────────────────────────────

function extractAccountId() {
  try {
    const cookies = document.cookie.split(';');
    for (const cookie of cookies) {
      const [name, value] = cookie.trim().split('=');
      if (name === '__aid_user_id') {
        return decodeURIComponent(value);
      }
    }
    console.warn('__aid_user_id cookie not found');
    return null;
  } catch (error) {
    console.error('Error extracting account ID:', error);
    return null;
  }
}

async function verifyGroupMembership(accountId, forgeEndpointUrl, apiKey) {
  const MAX_ATTEMPTS = 5;
  const DELAY_MS = 2000;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const response = await sendMessageWithTimeout({
        action: 'verifyMembership',
        accountId, forgeEndpointUrl, apiKey
      });
      if (response.isMember) return true;
    } catch (error) {
      console.warn(`Verification attempt ${attempt} failed:`, error);
    }
    if (attempt < MAX_ATTEMPTS) {
      await new Promise((r) => setTimeout(r, DELAY_MS));
    }
  }
  return false;
}

function openOptionsPage() {
  try {
    if (chrome.runtime && typeof chrome.runtime.openOptionsPage === 'function') {
      chrome.runtime.openOptionsPage();
      return;
    }
  } catch (e) { /* fallback below */ }

  try {
    const optionsUrl = chrome.runtime.getURL('options.html');
    chrome.tabs.create({ url: optionsUrl });
  } catch (err) {
    console.error('Failed to open options page:', err);
  }
}
