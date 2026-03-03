# Quick Start Guide

Get the Jira Login Interceptor running in under 10 minutes.

## Prerequisites

- Atlassian organization with Admin API access
- Forge CLI installed (`npm install -g @forge/cli`)
- Chrome or Chromium-based browser

---

## Step 1: Deploy the Forge App (5 minutes)

```bash
cd forge-app
npm install
forge deploy
forge install    # Select your Jira site when prompted
```

## Step 2: Configure the Forge App (3 minutes)

1. Open your Jira site
2. Go to **Apps** → **Jira Login Interceptor**
3. Follow the 3-step setup wizard:

### Step 1 of 3 — Select Group

1. **Enter your Atlassian Admin API key**
   - Go to https://admin.atlassian.com → **Settings** → **API keys**
   - Click **Create API key**, give it a name, set expiry
   - Copy the key and paste it into the wizard
   - Required scope: Organization admin (manages directories and groups)
2. **Select Organization** — use the searchable dropdown to find your org
3. **Select Directory** — pick the directory containing your target group
4. **Select Group** — pick the group users should be auto-added to
5. Click **Next**

### Step 2 of 3 — Security

1. Click **Generate API Key** — this creates a shared secret for the extension
2. Copy the generated API key (you'll need it for the extension)
3. Click **Next**

### Step 3 of 3 — Review & Save

1. Review the configuration summary
2. Click **Save Configuration**
3. Copy the **Webtrigger URL** and **API Key** shown on the overview page

## Step 3: Load the Chrome Extension (1 minute)

1. Open Chrome → `chrome://extensions/`
2. Toggle **Developer mode** (top right)
3. Click **Load unpacked** → select the `jira-login-interceptor/` folder

## Step 4: Configure the Extension (1 minute)

**Option A: Edit config.json** (best for distribution)

Edit `jira-login-interceptor/config.json`:

```json
{
  "forgeEndpointUrl": "https://your-webtrigger-url-from-step-2",
  "apiKey": "your-api-key-from-step-2"
}
```

Reload the extension at `chrome://extensions/`.

**Option B: Use the options page**

1. Click the extension icon → **Configure Settings**
2. Enter the **Forge Endpoint URL** and **API Key** from Step 2
3. Click **Save Settings**

**Option C: Drag & drop**

1. Save the webtrigger URL and API key as a JSON file:
   ```json
   { "forgeEndpointUrl": "https://...", "apiKey": "..." }
   ```
2. Open the extension options page
3. Drop the file onto the drop zone
4. Click **Save Settings**

## Step 5: Test It

1. Click **Test Connection** on the options page to verify the endpoint and API key
2. Log out of Jira
3. Log back in
4. You should see the interstitial overlay with progress steps
5. After completion, you'll be redirected to Jira
6. Verify: go to **Admin Console** → **People** → **Groups** → check the user is now a member

## Troubleshooting Quick Fixes

| Issue | Solution |
|-------|----------|
| Extension icon not visible | Click Extensions menu (puzzle icon) and pin |
| "Endpoint unreachable" | Verify the webtrigger URL is correct and Forge app is deployed |
| "API key is invalid" | Regenerate the API key in the Forge admin page |
| "Forge app not configured" | Complete the setup wizard (org/directory/group) |
| "Could not extract account ID" | Log in through the standard Atlassian login page |
| No overlay appears | Check the site uses `id.atlassian.com/login/authorize` |

## What Happens Behind the Scenes

1. Extension detects `id.atlassian.com/login/authorize` redirect
2. Pre-checks if user is already in the group (skips overlay if yes)
3. Shows interstitial overlay with 5 progress steps
4. Calls Forge webtrigger → Forge adds user to group via Atlassian Admin API
5. Polls membership verification (up to 5 attempts)
6. Redirects to the original Jira destination

## Next Steps

- [README.md](README.md) — full documentation
- [TECHNICAL.md](TECHNICAL.md) — architecture and internals
- [EXAMPLES.md](EXAMPLES.md) — API examples and use cases
- [TEST-PLAN.md](TEST-PLAN.md) — test cases

---

**You're all set!** The extension will automatically add users to the configured group on every Jira login.
