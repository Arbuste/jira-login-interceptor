/**
 * Service Worker for Group Membership Auto-Joiner
 * Proxies requests from the content script to the Forge webtrigger endpoint.
 */

console.log('Group Membership Auto-Joiner service worker initialized');

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'makeApiRequest') {
    callForgeEndpoint(request.forgeEndpointUrl, request.apiKey, 'addToGroup', request.accountId)
      .then((data) => {
        sendResponse({ success: true, data });
      })
      .catch((error) => {
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }

  if (request.action === 'verifyMembership') {
    callForgeEndpoint(request.forgeEndpointUrl, request.apiKey, 'verifyMembership', request.accountId)
      .then((data) => {
        sendResponse({ isMember: data.isMember === true });
      })
      .catch((error) => {
        sendResponse({ isMember: false, error: error.message });
      });
    return true;
  }
});

/**
 * Call the Forge webtrigger endpoint.
 *
 * @param {string} endpointUrl - The Forge webtrigger URL
 * @param {string} apiKey - The shared API key
 * @param {string} action - "addToGroup" or "verifyMembership"
 * @param {string} accountId - The user's Atlassian account ID
 * @returns {Promise<Object>} Parsed JSON response
 */
async function callForgeEndpoint(endpointUrl, apiKey, action, accountId) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(endpointUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ action, accountId }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Forge endpoint returned ${response.status}: ${errorText}`);
    }

    return await response.json();
  } catch (error) {
    clearTimeout(timeoutId);
    console.error('Forge endpoint error:', error);
    throw error;
  }
}
