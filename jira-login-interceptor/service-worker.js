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
    
    // Return true to indicate we'll send response asynchronously
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

    console.log('Making API request to add user to group:', {
      url: apiUrl,
      accountId: accountId,
      method: 'POST'
    });

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${bearerToken}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

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
