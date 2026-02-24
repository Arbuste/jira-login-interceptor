/**
 * Service Worker for Group Membership Auto-Joiner
 * Handles API requests on successful login
 *
 * Note: Login detection is handled by content-script.js (which runs on the login page)
 * This service worker only handles the API request to add the user to the group
 */

console.log('Group Membership Auto-Joiner service worker initialized');

/**
 * Handle requests from content script to make API calls
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'makeApiRequest') {
    makeApiRequest(
      request.accountId,
      request.orgId,
      request.directoryId,
      request.groupId,
      request.bearerToken
    )
      .then((response) => {
        sendResponse({success: true, data: response});
      })
      .catch((error) => {
        sendResponse({success: false, error: error.message});
      });
    return true;
  }

  if (request.action === 'verifyMembership') {
    checkGroupMembership(
      request.accountId,
      request.orgId,
      request.directoryId,
      request.groupId,
      request.bearerToken
    )
      .then((isMember) => {
        sendResponse({isMember});
      })
      .catch((error) => {
        sendResponse({isMember: false, error: error.message});
      });
    return true;
  }
});

/**
 * Make API request to add user to group
 * @param {string} accountId - The user's account ID
 * @param {string} orgId - The organization ID
 * @param {string} directoryId - The directory ID
 * @param {string} groupId - The group ID
 * @param {string} bearerToken - The API token for authentication
 * @returns {Promise} The API response
 */
async function makeApiRequest(accountId, orgId, directoryId, groupId, bearerToken) {
  try {
    const apiUrl = `https://api.atlassian.com/admin/v2/orgs/${orgId}/directories/${directoryId}/groups/${groupId}/memberships`;
    const requestBody = {
      accountId: accountId
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${bearerToken}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API request failed with status ${response.status}: ${response.statusText}. Response: ${errorText}`);
    }

    // Handle responses with no body (204 No Content)
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      return { status: response.status, statusText: response.statusText };
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('API request error:', error);
    throw error;
  }
}

/**
 * Check whether a user is a member of a group by querying the
 * directory users endpoint filtered by both groupId and accountId.
 * If the response contains at least one user, the membership exists.
 *
 * @param {string} accountId - The user's account ID
 * @param {string} orgId - The organization ID
 * @param {string} directoryId - The directory ID
 * @param {string} groupId - The group ID
 * @param {string} bearerToken - The API token for authentication
 * @returns {Promise<boolean>} true if user is in the group
 */
async function checkGroupMembership(accountId, orgId, directoryId, groupId, bearerToken) {
  const apiUrl = `https://api.atlassian.com/admin/v2/orgs/${orgId}/directories/${directoryId}/users?groupIds=${encodeURIComponent(groupId)}&accountIds=${encodeURIComponent(accountId)}&limit=1`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  const response = await fetch(apiUrl, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${bearerToken}`,
      'Accept': 'application/json'
    },
    signal: controller.signal
  });

  clearTimeout(timeoutId);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Membership check failed with status ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  // The endpoint returns a list of users matching both filters.
  // If the array is non-empty, the user is in the group.
  const isMember = Array.isArray(data.data) && data.data.length > 0;
  return isMember;
}
