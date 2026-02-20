# Group Membership Auto-Joiner Chrome Extension

A Chrome extension that automatically adds users to specified Atlassian groups upon successful login. When a user logs in to Jira/Confluence, the extension extracts their account ID and adds them to a configured group via the Atlassian Admin API.

## Features

- 🔍 **Detects Login**: Intercepts requests to `https://id.atlassian.com/login/authorize?continue=XURL`
- 🏷️ **Auto-Adds User**: Extracts `__aid_user_id` cookie and adds user to group
- 🛑 **Pauses Navigation**: Prevents redirect until group membership is confirmed
- 📡 **Secure API Call**: Uses Atlassian Admin API v2 with Bearer token authentication
- 🔒 **Secure**: Stores credentials in Chrome's sync storage
- ⚙️ **Configurable**: Easy-to-use settings page for group configuration

## Installation

### From Source (Development)

1. Extract the extension folder to your desired location
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" (toggle in top right)
4. Click "Load unpacked"
5. Select the `jira-login-interceptor` folder
6. The extension will appear in your extensions list

### Using the Extension

1. **Configure Settings**:
   - Click the extension icon in Chrome toolbar
   - Click "Configure Settings"
   - Enter your Atlassian API endpoint URL
   - Enter your Atlassian API token (get from: https://id.atlassian.com/manage-profile/security/api-tokens)
   - (Optional) Add a description of what this API call does
   - Click "Save Settings"

2. **Automatic Operation**:
   - When you log in to Jira, the extension will:
     - Detect the authorization redirect URL
     - Send the configured API request
     - Wait for the response
     - Then allow navigation to your destination

## Configuration

### Required Settings

1. **Organization ID**: Your Atlassian organization's unique ID
2. **Directory ID**: The directory where your group is located
3. **Group ID**: The group you want to automatically add users to
4. **Bearer Token**: Your Atlassian API token for authentication

### Obtaining Your IDs

#### Organization ID & Directory ID
1. Go to your Atlassian admin console: `https://admin.atlassian.com`
2. Navigate to **Organization settings** → **Identity & Access**
3. Go to **Directories** to find your Directory ID
4. Your Organization ID is visible in the URL or admin settings

#### Group ID
1. In the admin console, go to **People** → **Groups**
2. Find the group you want users to auto-join
3. The Group ID is shown in the group details (UUID format)

#### API Token
1. Go to https://id.atlassian.com/manage-profile/security/api-tokens
2. Click **Create API token**
3. Give it a descriptive name: "Group Auto-Joiner"
4. Copy the token and paste into extension settings

**⚠️ IMPORTANT**: Keep your API token secret! Anyone with this token can manage your Atlassian groups.

## How It Works

### Flow Diagram

```
1. User visits Jira/Confluence and logs in
2. Login successful, redirects to: https://id.atlassian.com/login/authorize?continue=REDIRECT_URL
3. Extension detects this request
4. Extension extracts __aid_user_id from login cookies
5. Extension pauses navigation
6. Extension calls Atlassian Admin API to add user to group
7. API confirms group membership added
8. Extension navigates to REDIRECT_URL
```

### Request Details

The extension makes a POST request to:
```
https://api.atlassian.com/admin/v2/orgs/{orgId}/directories/{directoryId}/groups/{groupId}/memberships
```

With request body:
```json
{
  "accountId": "the-extracted-user-id"
}
```

With headers:
```
Authorization: Bearer {apiToken}
Accept: application/json
Content-Type: application/json
```

## How It Works

### Flow Diagram

```
1. User logs in to Jira
2. Login successful, redirect to: https://id.atlassian.com/login/authorize?continue=REDIRECT_URL
3. Extension detects this request (content script)
4. Navigation is paused
5. Content script sends message to service worker
6. Service worker makes API request with stored credentials
7. Service worker sends response back to content script
8. Content script navigates to REDIRECT_URL
```

### Components

- **manifest.json**: Extension configuration and permissions
- **service-worker.js**: Background service worker that handles API requests
- **content-script.js**: Runs on login pages, intercepts navigation
- **popup.html/js**: Quick access popup showing extension status
- **options.html/js**: Settings page for configuration

## Troubleshooting

### Extension not triggering
- Check that your Jira site uses `https://id.atlassian.com/login/authorize`
- Verify the extension is enabled at `chrome://extensions/`

### "Could not extract account ID from cookies" error
- The `__aid_user_id` cookie wasn't found on the login page
- Try logging in with a different method
- Check that you're logging in through the standard Atlassian login page

### API request fails with 401/403
- Your API token is invalid or expired - create a new one
- Your API token doesn't have the required permissions
- Verify the token can access the Admin API v2

### API request fails with 404
- Organization ID, Directory ID, or Group ID is incorrect
- Double-check all IDs are in UUID format
- Verify the group still exists in your directory

### User not added to group
- The API request succeeded but group membership wasn't applied
- Check group membership limits or restrictions
- Verify the user account is in the correct directory

### Can't find the extension icon
- Click the Extensions puzzle icon in your toolbar
- Pin this extension by clicking the pin next to "Group Membership Auto-Joiner"

## Security Considerations

- API tokens are stored in Chrome's `sync` storage, which is encrypted
- Tokens are only sent via HTTPS to Atlassian servers
- The extension only intercepts Jira login redirects
- Consider creating a dedicated API token for this extension (easier to revoke if needed)

## Development

### Testing Locally

1. Make changes to files in the extension folder
2. Go to `chrome://extensions/`
3. Click the refresh icon under the extension

### Testing the Group Membership API

Before deploying, test that your API configuration works:

```bash
curl -X POST "https://api.atlassian.com/admin/v2/orgs/{orgId}/directories/{directoryId}/groups/{groupId}/memberships" \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  -H "Accept: application/json" \
  -H "Content-Type: application/json" \
  -d '{
    "accountId": "test-account-id"
  }'
```

Replace with your actual IDs and token to verify the endpoint is accessible and your token has permissions.

## Permissions Explained

- `webRequest`: Required to intercept login requests
- `tabs`: Required to send messages to content scripts
- `storage`: Required to store API credentials
- `host_permissions`: Required to access Atlassian domains

## Limitations

- Only works on https://id.atlassian.com/login/authorize URLs
- Requires manual configuration of Organization ID, Directory ID, Group ID, and API token
- Chrome only (not available for Firefox, Safari, etc.)
- The `__aid_user_id` cookie must be present in the login request (always present in standard Atlassian login flow)
- Only adds a single user to a single group - to add users to multiple groups, install multiple instances with different settings

## License

Use this extension freely for your own purposes.

## Support

For issues or questions:
1. Check the Troubleshooting section
2. Look at Chrome DevTools (F12) Console tab for error messages
3. Verify all settings in the options page

---

**Version**: 2.0  
**Last Updated**: 2026-02-19  
**API Used**: Atlassian Admin API v2  
**Endpoint**: POST `/admin/v2/orgs/{orgId}/directories/{directoryId}/groups/{groupId}/memberships`
