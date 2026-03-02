# Quick Start Guide

Get the Group Membership Auto-Joiner extension running in 5 minutes.

## Step 1: Load the Extension (2 minutes)

1. Open Chrome
2. Type in address bar: `chrome://extensions/`
3. Toggle **"Developer mode"** in top right corner
4. Click **"Load unpacked"**
5. Navigate to the `jira-login-interceptor` folder and select it
6. You should see the extension in your list

## Step 2: Get Your IDs and API Token (2 minutes)

### Get Organization & Directory IDs
1. Go to https://admin.atlassian.com
2. Navigate to **Organization settings** → **Identity & Access** → **Directories**
3. Note your:
   - **Organization ID** (visible in URL or settings)
   - **Directory ID** (shown for your directory)

### Get Group ID
1. In admin console, go to **People** → **Groups**
2. Find the group you want users to auto-join
3. Note the **Group ID** (UUID format)

### Get API Token
1. Open a new tab and go to: https://id.atlassian.com/manage-profile/security/api-tokens
2. Click **"Create API token"**
3. Give it a name: "Group Auto-Joiner"
4. Click **"Create"** then **"Copy"** to copy your token
5. Save it somewhere temporarily

## Step 3: Configure the Extension (1 minute)

1. Click the extension icon in Chrome toolbar (top right)
2. Click **"Configure Settings"**
3. Fill in the form with the values from Step 2:
   - **Organization ID**: Your org ID (UUID format)
   - **Directory ID**: Your directory ID (UUID format)
   - **Group ID**: The group ID (UUID format)
   - **Bearer Token**: Your API token from Step 2
4. Click **"Save Settings"**

## Step 4: Test It

1. Log out of your Jira instance
2. Refresh the page
3. Log in with your credentials
4. You should see a success notification
5. Check your group membership:
   - Go to Admin Console → People
   - Your account should now be listed in the group members
6. You'll be redirected to your Jira dashboard automatically

## Verification

After your first login:

1. Go to your Atlassian admin console
2. Navigate to **People** → **Groups**
3. Find the group you configured
4. You should see your account listed as a member
5. Success! The auto-joiner is working

## Troubleshooting Quick Fixes

| Issue | Solution |
|-------|----------|
| Extension icon not visible | Click Extensions menu (puzzle icon) and pin this extension |
| API request failed (401/403) | Create a new API token, your old one may be expired |
| "Could not extract account ID" | Make sure you're logging in through the standard Atlassian login page |
| User not in group after login | Check that Group ID, Directory ID, and Organization ID are correct |
| Blank error message | Check DevTools (F12) Console tab for details |

## What's Happening Behind the Scenes

When you log in:
1. Extension detects the `https://id.atlassian.com/login/authorize` request
2. Extension extracts your `__aid_user_id` from login cookies
3. Extension pauses navigation (you stay on login page momentarily)
4. Extension sends POST request to add you to the configured group
5. Extension waits for API response
6. Extension navigates to your final destination

This ensures your group membership is confirmed before you're redirected.

## Next Steps

- Read [README.md](README.md) for detailed documentation
- Check [EXAMPLES.md](EXAMPLES.md) for more Atlassian API information
- For advanced setups, see Development section in README

## Getting Help

1. Check the chrome://extensions page - is the extension enabled?
2. Open DevTools (F12) and look for error messages in the Console
3. Check the Options page to verify your settings are saved
4. Ensure your API token is still valid and hasn't expired
5. Verify your Group ID, Directory ID, and Organization ID are correct UUID formats

---

**You're all set!** Your group membership auto-joiner is now active and will automatically add you to the configured group on every Jira login.
