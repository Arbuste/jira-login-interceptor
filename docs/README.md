# Jira Login Interceptor

A two-component system that automatically adds users to a specified Atlassian group upon Jira login. It consists of a **Forge app** (backend, deployed to Atlassian) and a **Chrome extension** (client-side, distributed to end users).

## Architecture

```
┌─────────────────────┐      ┌──────────────────────┐      ┌─────────────────────┐
│   Chrome Extension  │      │     Forge App         │      │  Atlassian Admin    │
│                     │ POST │   (webtrigger)        │      │    API v2           │
│  content-script.js  │─────>│                       │─────>│                     │
│  service-worker.js  │      │  - addToGroup         │      │  /orgs/.../groups/  │
│  options page       │<─────│  - verifyMembership   │<─────│  .../memberships    │
│                     │      │                       │      │                     │
└─────────────────────┘      │  Admin Config UI      │      └─────────────────────┘
                             │  (React wizard)       │
                             └──────────────────────┘
```

- The **Forge app** stores org/directory/group configuration, an Atlassian Admin API key, and a shared API key. It exposes a webtrigger endpoint that the extension calls.
- The **Chrome extension** intercepts Jira login redirects, extracts the user's account ID from cookies, and calls the Forge webtrigger to add the user to the configured group.

## Features

- **Detects Login**: Intercepts `https://id.atlassian.com/login/authorize?continue=...` pages
- **Auto-Adds User**: Extracts `__aid_user_id` cookie and triggers group membership via Forge
- **Pauses Navigation**: Shows an interstitial overlay until group membership is confirmed
- **Pre-check**: Skips the overlay entirely if the user is already a member
- **Secure**: Extension only stores the Forge endpoint URL and a shared API key — no Atlassian tokens
- **Admin Wizard**: Forge admin page with searchable dropdowns for org/directory/group selection
- **Pre-configurable**: Admin fills `config.json` or uses the extension options page
- **Drag & Drop Config**: Options page accepts a dropped `config.json` file for quick setup

## Components

### Forge App (`forge-app/`)

| File | Role |
|------|------|
| `manifest.yml` | Forge app manifest — admin page, webtrigger, resolver, permissions |
| `src/handlers/configResolver.ts` | Resolver functions: config CRUD, list orgs/directories/groups, API key management |
| `src/admin-api.ts` | Atlassian Admin API v2 client with cursor-based pagination |
| `src/handlers/webhookHandler.ts` | Webtrigger handler: addToGroup, verifyMembership |
| `admin-config/src/ConfigPage.tsx` | Main admin UI — routes between wizard and overview |
| `admin-config/src/SetupWizard.tsx` | Three-step wizard (Group → Security → Review) |
| `admin-config/src/components/StepGroup.tsx` | Step 1: Admin API key + searchable org/directory/group selection |
| `admin-config/src/components/SearchableSelect.tsx` | Reusable searchable dropdown component |
| `admin-config/src/utils.ts` | Shared utility (resolveDisplayName) |

### Chrome Extension (`jira-login-interceptor/`)

| File | Role |
|------|------|
| `manifest.json` | Chrome MV3 manifest — permissions, content scripts, service worker |
| `config.json` | Admin-provided config: `{ forgeEndpointUrl, apiKey }` |
| `js/config-loader.js` | Shared settings loader — chrome.storage.local first, then config.json fallback |
| `js/content-script.js` | Login detection, interstitial overlay, orchestrates the 5-step flow |
| `js/service-worker.js` | Proxies requests to the Forge webtrigger endpoint |
| `js/options.js` | Settings page: save/load, connection test, drag & drop config import |
| `js/popup.js` | Toolbar popup showing configured/not-configured status |
| `pages/options.html` | Options page markup with drop zone and form |
| `pages/popup.html` | Toolbar popup markup |

## Installation

### 1. Deploy the Forge App

```bash
cd forge-app
npm install
forge deploy
forge install  # Install on your Atlassian site
```

### 2. Configure the Forge App

1. Open your Jira site
2. Go to **Apps** → **Jira Login Interceptor** (admin page)
3. Follow the setup wizard:
   - **Step 1**: Enter your Atlassian Admin API key, then select your organization, directory, and group using the searchable dropdowns
   - **Step 2**: Generate a shared API key for the extension
   - **Step 3**: Review and save. Copy the webtrigger URL and API key.

### 3. Load the Chrome Extension

1. Open Chrome → `chrome://extensions/`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked** → select the `jira-login-interceptor/` folder

### 4. Configure the Extension

**Option A: Pre-fill `config.json` (recommended for distribution)**

Edit `jira-login-interceptor/config.json` before distributing:

```json
{
  "forgeEndpointUrl": "https://your-forge-webtrigger-url",
  "apiKey": "your-shared-api-key"
}
```

**Option B: Options page**

1. Click the extension icon → **Configure Settings**
2. Enter the Forge Endpoint URL and API key
3. Click **Save Settings**

**Option C: Drag & drop**

1. Open the extension options page
2. Drop a `config.json` file onto the drop zone
3. Click **Save Settings** to persist

## Configuration Priority

Settings are resolved in this order by `config-loader.js`:

1. **`chrome.storage.local`** — user-saved settings from the options page (highest priority)
2. **`config.json`** — bundled defaults pre-filled by the admin (fallback)

If neither source has complete settings, the extension opens the options page.

## How It Works

### Login Flow

1. User logs in to Jira → browser redirects to `id.atlassian.com/login/authorize?continue=...`
2. Content script intercepts the page and blocks navigation
3. Pre-checks if user is already a group member (skips overlay if yes)
4. Shows interstitial overlay with 5 progress steps:
   - Login detected
   - Account ID extracted (from `__aid_user_id` cookie)
   - Adding to group (POST to Forge webtrigger)
   - Verifying membership (polls up to 5 times)
   - Redirecting to destination
5. Browser navigates to the original Jira URL

### Connection Test

The options page **Test Connection** button performs a two-step check:
1. **Endpoint reachability** — sends a request without auth to confirm the URL is valid
2. **API key validation** — sends a request with the API key to verify it's accepted

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Extension not triggering | Verify the site uses `id.atlassian.com/login/authorize` for login |
| "Could not extract account ID" | `__aid_user_id` cookie not found — try standard Atlassian login |
| "Endpoint unreachable" | Check the Forge Endpoint URL is correct and the Forge app is deployed |
| "API key is invalid" | Regenerate the API key in the Forge admin page and update the extension |
| "Forge app not configured" | Complete the setup wizard in the Forge admin page (org/directory/group) |
| User not added to group | Check the Atlassian Admin API key permissions and group configuration |
| Extension icon not visible | Click the Extensions puzzle icon and pin this extension |

## Security

- The Chrome extension **never** stores or sees the Atlassian Admin API key — only the Forge app has it
- The shared API key is transmitted over HTTPS via `Authorization: Bearer` header
- Extension stores only `forgeEndpointUrl` and `apiKey` in `chrome.storage.local` (on-device only)
- Redirect URLs are validated: HTTPS only, `*.atlassian.com` or `*.atlassian.net` domains
- The Forge Endpoint URL must use HTTPS (validated on save)
- No sensitive data (account IDs, tokens, API URLs) is logged to the console

## Permissions

### Chrome Extension

- `storage`: Store extension settings
- `host_permissions`: Access `id.atlassian.com/login/authorize*` (content script) and the Forge webtrigger URL

### Forge App

- `storage:app` — Forge app storage for configuration
- `external fetch` — `https://api.atlassian.com` for Admin API calls

## Limitations

- Chrome/Chromium only (not available for Firefox, Safari)
- Adds users to a single group per installation
- Requires the `__aid_user_id` cookie (present in standard Atlassian login flow)
- Only works on `id.atlassian.com/login/authorize` URLs

---

**Version**: 4.0
**Last Updated**: 2026-03-02
