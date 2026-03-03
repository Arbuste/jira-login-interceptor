# Configuration Examples & Use Cases

This document covers setup examples and common use cases for the Jira Login Interceptor.

## System Overview

The system has two components:
1. **Forge app** — deployed to Atlassian, manages org/directory/group config and API keys
2. **Chrome extension** — distributed to end users, intercepts login and calls the Forge webtrigger

The extension only needs two values: the Forge webtrigger URL and a shared API key. All Atlassian API interaction happens server-side in the Forge app.

---

## Setting Up the Forge App

### Creating the Atlassian Admin API Key

The Forge app needs an Atlassian organization admin API key to list orgs/directories/groups and manage memberships.

1. Go to https://admin.atlassian.com
2. Click **Settings** (bottom left) → **API keys**
3. Click **Create API key**
4. Name: "Jira Login Interceptor" (or similar)
5. Set expiry (12 months max)
6. Click **Create**
7. **Copy the key immediately** — it won't be shown again
8. Paste into the Forge admin wizard (Step 1)

**Required scope**: Organization admin — this grants read/write access to directories and groups.

### Navigating the Setup Wizard

1. Open your Jira site → **Apps** → **Jira Login Interceptor**
2. **Step 1 — Select Group**:
   - Paste the admin API key
   - Use the searchable dropdowns to select org → directory → group
   - Type to filter — dropdowns support client-side search
3. **Step 2 — Security**:
   - Click **Generate API Key** to create the shared secret
   - This key is what the Chrome extension uses to authenticate
4. **Step 3 — Review & Save**:
   - Verify the summary
   - Click **Save Configuration**
5. **Overview** shows the webtrigger URL and API key — copy both for the extension

---

## Configuring the Chrome Extension

### Method 1: Pre-fill `config.json` (best for distribution)

Edit `jira-login-interceptor/config.json`:

```json
{
  "forgeEndpointUrl": "https://your-forge-webtrigger-url",
  "apiKey": "your-shared-api-key-from-forge"
}
```

Distribute the extension folder — it works out of the box.

### Method 2: Options Page (manual)

1. Click the extension icon → **Configure Settings**
2. Enter:
   - **Forge Endpoint URL**: The webtrigger URL from the Forge admin page
   - **API Key**: The shared API key from the Forge admin page
3. Click **Save Settings**

### Method 3: Drag & Drop Config Import

1. Create a JSON file with:
   ```json
   {
     "forgeEndpointUrl": "https://your-forge-webtrigger-url",
     "apiKey": "your-shared-api-key"
   }
   ```
2. Open the extension options page
3. Drop the file onto the drop zone (or click to browse)
4. Fields are auto-populated — click **Save Settings** to persist

### Testing the Connection

The options page has a **Test Connection** button that performs:

1. **Endpoint reachability test** — sends a POST to the URL without auth
   - Any response (even 401) = endpoint is reachable
   - Network error = endpoint unreachable
2. **API key validation** — sends a POST with `Authorization: Bearer <key>`
   - 401 = key is invalid
   - 200 = all good
   - 500 with "not configured" = Forge app needs setup (org/directory/group)

---

## Common Use Cases

### All Employees Group

Auto-add every login user to an "All Employees" group.

**Setup**:
1. Create a group "All Employees" in your Atlassian directory
2. Select it in the Forge admin wizard
3. Distribute the extension — every user who logs in gets added

### Project-Specific Access

Add contractors or external users to project-specific groups.

**Setup**:
1. Create groups per project (e.g., "Project-X-Team")
2. Deploy separate Forge apps or change the group in the wizard per team
3. Distribute the extension with the appropriate config

### Compliance Groups

Ensure all active users are in required compliance/auditing groups.

**Setup**:
1. Create "Compliance-Required" group
2. Configure via wizard
3. Everyone who logs in is automatically compliant

---

## API Response Codes (Forge Webtrigger)

| Code | Meaning | Action |
|------|---------|--------|
| 200 | Success | User added or membership verified |
| 401 | Unauthorized | Shared API key is invalid — regenerate in Forge admin |
| 500 | Server error | Forge app may not be configured — check wizard setup |

### Atlassian Admin API Codes (handled by Forge)

| Code | Meaning |
|------|---------|
| 201 | User added to group |
| 409 | User already a member (treated as success) |
| 401 | Admin API key invalid or expired |
| 403 | Admin API key lacks permissions |
| 404 | Org/directory/group ID doesn't exist |
| 429 | Rate limited — try again later |

---

## Troubleshooting API Calls

### "Endpoint unreachable"
- Forge app may not be deployed: run `forge deploy`
- URL may be wrong: copy the exact webtrigger URL from the Forge admin overview

### "API key is invalid"
- Regenerate the shared API key in the Forge admin wizard (Step 2)
- Make sure you copied the full key

### "Forge app not fully configured"
- Complete the setup wizard: select org, directory, and group
- Ensure the admin API key is set and valid

### User not added to group
- Check that the Atlassian Admin API key hasn't expired (max 12 months)
- Verify the group still exists in the directory
- Check Forge logs: `forge logs`

---

## Security Best Practices

1. **Admin API key stays server-side**: Only stored in Forge app storage, never exposed to the extension
2. **Rotate the shared API key**: Regenerate periodically in the Forge admin wizard
3. **HTTPS only**: The extension validates the Forge endpoint URL uses HTTPS
4. **Minimal extension permissions**: Only `id.atlassian.com/login/authorize*` for content script
5. **Monitor usage**: Check Forge logs (`forge logs`) and Atlassian admin audit logs

---

**Last Updated**: 2026-03-02
