# Technical Documentation — Group Membership Auto-Joiner

> Maintained by: Engineering
> Extension version: 3.0
> Manifest version: MV3 (Chrome Extensions Manifest V3)
> Last updated: 2026-02-24

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [File Inventory](#2-file-inventory)
3. [Runtime Lifecycle](#3-runtime-lifecycle)
4. [Component Deep-Dive](#4-component-deep-dive)
5. [Message Protocol](#5-message-protocol)
6. [Security Model](#6-security-model)
7. [Timeouts & Retry Strategy](#7-timeouts--retry-strategy)
8. [Storage Schema](#8-storage-schema)
9. [Interstitial Overlay](#9-interstitial-overlay)
10. [Error Handling & Recovery](#10-error-handling--recovery)
11. [Known Constraints & Limitations](#11-known-constraints--limitations)
12. [Maintenance Checklist](#12-maintenance-checklist)
13. [Dependency Map](#13-dependency-map)
14. [Glossary](#14-glossary)

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│  Browser (Chrome / Chromium)                                        │
│                                                                     │
│  ┌──────────────────────────────────┐   chrome.runtime.sendMessage  │
│  │  Content Script                   │ ──────────────────────────►  │
│  │  (config-loader.js               │                              │
│  │   + content-script.js)            │   ◄──────────────────────── │
│  │  Runs on:                         │       sendResponse           │
│  │  id.atlassian.com/login/authorize │                              │
│  │                                    │  ┌─────────────────────────┐│
│  │  - Loads settings (config.json    │  │  Service Worker          ││
│  │    then chrome.storage.local)     │  │  (service-worker.js)     ││
│  │  - Detects login page             │  │                           ││
│  │  - Extracts __aid_user_id cookie  │  │  - POST add-to-group     ││
│  │  - Shows interstitial overlay     │  │  - GET verify-membership  ││
│  │  - Blocks navigation             │  │  - 15s fetch timeout      ││
│  │  - Validates redirect URL         │  │                           ││
│  └──────────────────────────────────┘  └─────────────────────────┘│
│                                                    │                │
│  ┌──────────────┐  ┌──────────────┐               │ fetch()        │
│  │  popup.html   │  │  options.html │               ▼               │
│  │  config-loader│  │  options.js   │    ┌─────────────────────┐   │
│  │  popup.js     │  │  CRUD settings│    │ Atlassian Admin API  │   │
│  │  Status check │  │  (fallback)   │    │ api.atlassian.com    │   │
│  └──────────────┘  └──────────────┘    └─────────────────────┘   │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  config.json (admin-provided, bundled with extension)          │  │
│  │  Keys: orgId, directoryId, groupId, bearerToken                │  │
│  ├───────────────────────────────────────────────────────────────┤  │
│  │  chrome.storage.local (fallback, manual via options page)      │  │
│  │  Keys: orgId, directoryId, groupId, bearerToken                │  │
│  └───────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

The extension follows the standard MV3 pattern:

- **Config loader** (`config-loader.js`) provides a shared `loadSettings()` function used by both the content script and the popup. It reads `config.json` first (admin-provided), falling back to `chrome.storage.local` (manual configuration via options page).
- **Content script** runs in the context of the web page (`id.atlassian.com`). It has access to the DOM and cookies but cannot make cross-origin API calls.
- **Service worker** runs in the extension's background context. It can make cross-origin `fetch()` calls to `api.atlassian.com` thanks to `host_permissions`.
- Communication between the two uses `chrome.runtime.sendMessage` / `sendResponse`.

---

## 2. File Inventory

| File | Role | Size | Notes |
|------|------|------|-------|
| `manifest.json` | Extension manifest (MV3) | ~35 lines | Defines permissions, content scripts, service worker, web-accessible resources |
| `config.json` | Admin configuration | ~6 lines | Pre-filled by admin before distributing; empty values trigger fallback to storage |
| `config-loader.js` | Shared settings loader | ~25 lines | `loadSettings()`: tries config.json, falls back to chrome.storage.local |
| `content-script.js` | Login detection & UI | ~500 lines | Injected into `id.atlassian.com/login/authorize*` |
| `service-worker.js` | API proxy | ~140 lines | Handles fetch to Atlassian Admin API |
| `options.html` | Settings page markup | ~245 lines | Form for orgId, directoryId, groupId, bearerToken |
| `options.js` | Settings page logic | ~100 lines | Load/save/reset to `chrome.storage.local` (fallback mechanism) |
| `popup.html` | Toolbar popup markup | ~90 lines | Status indicator + link to settings; loads config-loader.js |
| `popup.js` | Toolbar popup logic | ~35 lines | Uses `loadSettings()` to display configured/not-configured |
| `README.md` | User-facing docs | ~100 lines | Installation, usage, troubleshooting |
| `QUICKSTART.md` | Quick start guide | — | Abbreviated setup guide |
| `EXAMPLES.md` | Usage examples | — | cURL examples, ID retrieval steps |

---

## 3. Runtime Lifecycle

### 3.1 Extension Load

1. Chrome loads `manifest.json`.
2. Service worker (`service-worker.js`) is registered and starts.
3. Content script injection rule is registered: inject `config-loader.js` then `content-script.js` on any URL matching `https://id.atlassian.com/login/authorize*` at `document_start`.

### 3.2 Login Interception (Happy Path)

```
Time ──────────────────────────────────────────────────────────►

  User logs in to Jira
       │
       ▼
  Browser navigates to id.atlassian.com/login/authorize?continue=https://xxx.atlassian.net/...
       │
       ▼
  content-script.js injected (document_start)
       │
       ▼
  checkAndHandleLoginPage()
    ├── Parses URL, extracts `continue` param
    ├── Sets navigationBlocked = true  ← immediate, before setTimeout
    └── setTimeout(handleLoginRedirect, 100ms)  ← wait for cookies
              │
              ▼
         handleLoginRedirect(continueUrl)
           ├── loginInProgress = true  (concurrent execution guard)
           ├── createInterstitialOverlay()  ← full-screen dark overlay
           ├── Step 1: loadSettings() — config.json first, then chrome.storage.local
           │     └── If neither configured → error overlay → open options → redirect
           ├── Step 2: extractAccountId() ← reads __aid_user_id cookie
           │     └── If missing → error overlay → redirect after 3s
           ├── Step 3: sendMessageWithTimeout({ action: 'makeApiRequest', ... })
           │     └── Service worker POST to Admin API
           │     └── If fails → error overlay → redirect after 3s
           ├── Step 4: verifyGroupMembership() ← up to 5 polls, 2s apart
           │     ├── If confirmed → green checkmark
           │     └── If unconfirmed → amber warning (still redirects)
           ├── Step 5: navigateTo(continueUrl)
           │     └── URL validation: must be https + *.atlassian.com|net
           └── finally: loginInProgress = false
```

### 3.3 Service Worker Lifecycle (MV3)

The service worker is **event-driven** and may be terminated by Chrome after ~30 seconds of inactivity. It wakes on `chrome.runtime.onMessage`. This is why:
- The content script has a 20-second message timeout (`sendMessageWithTimeout`).
- All fetch calls have a 15-second `AbortController` timeout.

### 3.4 Page Unload Prevention

While `navigationBlocked === true`:
- `beforeunload` event handler calls `event.preventDefault()` and sets `event.returnValue`.
- Click handler on `document` (capture phase) intercepts all `<a>` clicks and calls `event.preventDefault()`.

---

## 4. Component Deep-Dive

### 4.1 content-script.js

#### Global State

| Variable | Type | Purpose |
|----------|------|---------|
| `navigationBlocked` | `boolean` | When `true`, `beforeunload` and link clicks are blocked |
| `overlayElement` | `HTMLElement\|null` | Reference to the interstitial overlay DOM node |
| `loginInProgress` | `boolean` | Concurrent execution guard for `handleLoginRedirect` |
| `STEPS` | `Array<{label}>` | 5-step definitions for the overlay UI |

#### Key Functions

| Function | Purpose |
|----------|---------|
| `checkAndHandleLoginPage()` | Entry point. Parses URL, validates it's a login page, starts flow. |
| `handleLoginRedirect(continueUrl)` | Orchestrates the 5-step process. Guarded by `loginInProgress`. |
| `sendMessageWithTimeout(message, timeoutMs)` | Wraps `chrome.runtime.sendMessage` with a Promise + timeout. Default 20s. |
| `createInterstitialOverlay()` | Builds and injects the full-screen overlay. Idempotent (returns existing if present). |
| `updateInterstitialStep(stepNumber, status, message)` | Updates a step's icon, color, and progress bar. Statuses: `active`, `completed`, `warning`, `error`. |
| `extractAccountId()` | Reads `__aid_user_id` from `document.cookie`. Returns `string\|null`. |
| `verifyGroupMembership(...)` | Polls the service worker up to 5 times with 2s intervals. Returns `boolean`. |
| `navigateTo(url)` | **Validates URL** against allowlist (`*.atlassian.com`, `*.atlassian.net`, HTTPS only) then sets `window.location.href`. |
| `allowNavigation(continueUrl)` | Thin wrapper around `navigateTo`. |
| `openOptionsPage()` | Opens extension options via `chrome.runtime.openOptionsPage()` with fallback to `chrome.tabs.create`. |

### 4.2 service-worker.js

#### Message Handler

Listens for two actions via `chrome.runtime.onMessage`:

| Action | Handler | HTTP Method | Endpoint |
|--------|---------|-------------|----------|
| `makeApiRequest` | `makeApiRequest()` | `POST` | `/admin/v2/orgs/{orgId}/directories/{directoryId}/groups/{groupId}/memberships` |
| `verifyMembership` | `checkGroupMembership()` | `GET` | `/admin/v2/orgs/{orgId}/directories/{directoryId}/users?groupIds=...&accountIds=...&limit=1` |

Both handlers return `true` from `onMessage.addListener` to keep the `sendResponse` channel open for async responses.

#### Fetch Timeout Pattern

Both functions use the same pattern:
```js
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 15000);
const response = await fetch(url, { ..., signal: controller.signal });
clearTimeout(timeoutId);
```

If the timeout fires, `controller.abort()` causes `fetch` to throw an `AbortError`.

### 4.3 options.js

- **Load**: On `DOMContentLoaded`, reads 4 keys from `chrome.storage.local`.
- **Save**: On form submit, validates all fields are non-empty, validates `orgId`, `directoryId`, and `groupId` are UUIDs (`/^[a-z0-9]{8}-...-[a-z0-9]{12}$/i`), then writes to `chrome.storage.local`.
- **Reset**: Confirms with `window.confirm()`, then removes all 4 keys.

### 4.4 config-loader.js

Exposes a single async function `loadSettings()` used by both the content script and the popup:

1. Fetches `config.json` via `chrome.runtime.getURL()`.
2. If the file exists, parses it, and all 4 keys are non-empty → returns the config object.
3. Otherwise (file missing, invalid JSON, or any empty value) → falls back to `chrome.storage.local.get()`.

### 4.5 popup.js

- On `DOMContentLoaded`, calls `loadSettings()` (from `config-loader.js`).
- If all 4 settings are present (from either config.json or storage), shows green "configured" status.
- If any missing, shows red "not configured" status.
- "Configure Settings" button opens `chrome.runtime.openOptionsPage()`.

---

## 5. Message Protocol

### content-script.js → service-worker.js

#### `makeApiRequest`

**Request:**
```json
{
  "action": "makeApiRequest",
  "accountId": "5f7c...user-id",
  "orgId": "uuid",
  "directoryId": "uuid",
  "groupId": "uuid",
  "bearerToken": "token-string"
}
```

**Response (success):**
```json
{
  "success": true,
  "data": { "status": 201, "statusText": "Created" }
}
```

**Response (failure):**
```json
{
  "success": false,
  "error": "API request failed with status 403: Forbidden. Response: ..."
}
```

#### `verifyMembership`

**Request:**
```json
{
  "action": "verifyMembership",
  "accountId": "5f7c...user-id",
  "orgId": "uuid",
  "directoryId": "uuid",
  "groupId": "uuid",
  "bearerToken": "token-string"
}
```

**Response (member):**
```json
{ "isMember": true }
```

**Response (not member / error):**
```json
{ "isMember": false, "error": "..." }
```

---

## 6. Security Model

### 6.1 Open Redirect Protection

`navigateTo(url)` validates:
1. `parsed.protocol === 'https:'` — no `http:`, `javascript:`, `data:`, etc.
2. `parsed.hostname` ends with `.atlassian.com` or `.atlassian.net` — blocks phishing redirects.

If either check fails, the redirect is blocked and an error is logged.

### 6.2 Token Storage

Tokens are stored in `chrome.storage.local` (on-device only). Unlike `chrome.storage.sync`, this does **not** sync through Google servers.

**Implication:** If a user switches devices, they must re-enter their settings.

### 6.3 Host Permissions (Principle of Least Privilege)

```json
"host_permissions": [
  "https://id.atlassian.com/login/authorize*",
  "https://api.atlassian.com/*"
]
```

- `id.atlassian.com/login/authorize*`: Required for content script injection.
- `api.atlassian.com/*`: Required for service worker API calls.
- No wildcard Atlassian permissions (e.g., `*.atlassian.net` was removed).

### 6.4 Logging Hygiene

- `console.log` calls that exposed account IDs, cookie values, or full API URLs have been removed.
- Only `console.error`, `console.warn`, and non-sensitive status logs remain.
- The initialization log (`'Jira Login Interceptor content script loaded'`) is kept for debugging.

### 6.5 Input Validation

- `orgId`, `directoryId`, `groupId` are validated as UUIDs on the options page.
- `bearerToken` is validated as non-empty (no format constraint — Atlassian tokens vary).
- `continueUrl` is validated by `navigateTo()` before redirect.

---

## 7. Timeouts & Retry Strategy

| Layer | Timeout | Mechanism | Consequence on Timeout |
|-------|---------|-----------|----------------------|
| Service worker fetch | 15 seconds | `AbortController` | Throws `AbortError`, caught by service worker, returned as error response |
| Content script → service worker message | 20 seconds | `setTimeout` + `Promise.reject` | Caught in `handleLoginRedirect` catch block, error overlay shown, redirects after 3s |
| Membership verification polling | 5 attempts x 2s delay = ~10s total + 5x message timeout worst case | Loop with `sendMessageWithTimeout` | Returns `false` after all attempts exhausted, shows amber warning, still redirects |
| Cookie extraction delay | 100ms | `setTimeout` before `handleLoginRedirect` | Ensures `__aid_user_id` cookie is available after page load |

### Worst-Case Timeline

If Atlassian API is completely down:
1. 100ms cookie delay
2. Step 3 (add to group): 20s message timeout → error → 3s delay → redirect

**Total worst case: ~23 seconds** before the user is redirected.

If API succeeds but membership verification times out:
1. 100ms + Steps 1-3 (~2-3s) + Step 4 (5 attempts x (20s timeout + 2s delay)) = ~113s

**Mitigation**: In practice, the fetch timeout (15s) fires before the message timeout (20s), so each verification attempt costs at most ~17s in the failure case. With 5 attempts: ~85s. Consider reducing `MAX_ATTEMPTS` or `DELAY_MS` if this is too long.

---

## 8. Storage Schema

### Configuration Priority

Settings are resolved in this order by `loadSettings()` (in `config-loader.js`):

1. **`config.json`** (bundled with the extension, pre-filled by the admin). If all 4 values are non-empty, these are used.
2. **`chrome.storage.local`** (manual fallback via options page). Used if `config.json` is missing, corrupt, or has any empty value.
3. If neither source has complete settings, the extension treats itself as "not configured" and opens the options page.

### config.json

Shipped with the extension. The admin fills all 4 values before distributing. Located at the extension root.

```json
{
  "orgId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "directoryId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "groupId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "bearerToken": "ATATT3x..."
}
```

If any value is an empty string, the entire file is skipped and `chrome.storage.local` is tried instead.

### chrome.storage.local (fallback)

| Key | Type | Example | Validated |
|-----|------|---------|-----------|
| `orgId` | UUID string | `a1b2c3d4-e5f6-7890-abcd-ef1234567890` | UUID regex in options.js |
| `directoryId` | UUID string | `a1b2c3d4-e5f6-7890-abcd-ef1234567890` | UUID regex in options.js |
| `groupId` | UUID string | `a1b2c3d4-e5f6-7890-abcd-ef1234567890` | UUID regex in options.js |
| `bearerToken` | string | `ATATT3x...` | Non-empty check only |

### Migration Note

Version 2.0 used `chrome.storage.sync`. Version 3.0 uses `chrome.storage.local`. There is **no automatic migration**. Users upgrading from v2 must re-enter their settings on the options page.

---

## 9. Interstitial Overlay

### DOM Structure

```
#jli-interstitial (fixed fullscreen, z-index: 999999)
 └── card (centered container)
      ├── h2 "Setting up your access"
      ├── p  "Please wait while we configure..."
      ├── #jli-steps
      │    ├── #jli-step-1 → .jli-step-icon + .jli-step-label
      │    ├── #jli-step-2
      │    ├── #jli-step-3
      │    ├── #jli-step-4
      │    └── #jli-step-5
      ├── progress track
      │    └── #jli-progress (animated width bar)
      └── #jli-status (status message text)
```

### Step Statuses

| Status | Icon | Icon BG | Label Color | Progress Bar |
|--------|------|---------|-------------|-------------|
| `pending` (default) | Number | `#21262d` | `#484f58` | No change |
| `active` | Spinning SVG circle | `#1f6feb` | `#e6edf3` | Advances to `stepNumber / 5 * 100%` |
| `completed` | Checkmark SVG | `#238636` | `#7ee787` | Advances to `stepNumber / 5 * 100%` |
| `warning` | Exclamation SVG | `#9e6a03` | `#d29922` | Advances to `stepNumber / 5 * 100%` (stays green) |
| `error` | X SVG | `#da3633` | `#f85149` | Stays at `(stepNumber - 1) / 5 * 100%`, turns red |

### CSS Animation

A `@keyframes jli-spin` rule is injected once into `<head>` when the first `active` status is set. ID: `#jli-keyframes`.

---

## 10. Error Handling & Recovery

### Error Categories

| Error | Step | User Impact | Recovery |
|-------|------|-------------|----------|
| Extension not configured | 1 | Options page opens automatically | User enters settings, refreshes page |
| Cookie not found | 2 | Overlay shows error | Auto-redirects after 3s |
| API 401/403 | 3 | "Failed to add to group" | Token expired; user reconfigures in options |
| API 404 | 3 | "Failed to add to group" | Wrong org/directory/group ID |
| API timeout (15s) | 3 | "Failed to add to group" | Transient; retry by refreshing page |
| Service worker unresponsive (20s) | 3 or 4 | "Service worker did not respond" | Service worker crashed; Chrome will restart it |
| Verification fails after 5 attempts | 4 | Amber warning, still redirects | Eventual consistency; membership may appear later |
| Untrusted redirect URL | 5 | Redirect silently blocked | User sees nothing; check console for error |
| Unexpected exception | Any active step | Current step turns red | Auto-redirects after 3s |

### Catch-All Handler

In `handleLoginRedirect`, the outer `catch` block:
1. Finds the currently-active step (by looking for the spinning SVG).
2. Marks it as `error`.
3. Waits 3 seconds.
4. Unblocks navigation and redirects.

The `finally` block always resets `loginInProgress = false`.

---

## 11. Known Constraints & Limitations

1. **Single group only**: The extension adds the user to exactly one group. Multi-group support would require an array of `groupId` values and looping the API call.

2. **Cookie dependency**: `__aid_user_id` must be set by Atlassian's login flow. Non-standard SSO providers (e.g., custom SAML IdPs that redirect differently) may not set this cookie on `id.atlassian.com`.

3. **No migration from v2 sync storage**: Users upgrading from v2 lose their saved settings.

4. **MV3 service worker lifecycle**: Chrome may terminate the service worker at any time. The 20-second message timeout handles this, but rapid back-to-back logins could hit edge cases.

5. **No offline support**: The extension requires network access to `api.atlassian.com`. If the network is down, step 3 will fail and the user is redirected without group membership.

6. **Verification polling duration**: With 5 attempts and 2s intervals, verification can take up to ~10s in the success case. If the API is slow, up to ~85s worst case (see Section 7).

7. **Browser support**: Chrome/Chromium only. Firefox uses a different extension API surface (MV2 with `browser.*`).

---

## 12. Maintenance Checklist

### When Updating the Atlassian Admin API

- [ ] Check if the API endpoint paths have changed (`/admin/v2/orgs/.../groups/.../memberships`).
- [ ] Check if the response format for `checkGroupMembership` has changed (expects `{ data: [...] }`).
- [ ] Check if new authentication schemes are required (currently: Bearer token).
- [ ] Update `service-worker.js` functions accordingly.

### When Updating Permissions

- [ ] Edit `manifest.json` `host_permissions` and `permissions`.
- [ ] Update the "Permissions Explained" section in `README.md`.
- [ ] If adding new domains, consider whether `navigateTo()` allowlist needs updating.

### When Changing Storage Keys

- [ ] Update `config.json` (add/remove keys).
- [ ] Update `config-loader.js` (`loadSettings` — both config.json read and chrome.storage.local fallback).
- [ ] Update `options.js` (load, save, reset).
- [ ] Update `popup.js` (status check).
- [ ] Update `content-script.js` (`handleLoginRedirect` settings read).
- [ ] Update this document's Storage Schema section.

### When Modifying the Interstitial

- [ ] `STEPS` array in `content-script.js` defines step count and labels.
- [ ] `updateInterstitialStep()` handles the visual states.
- [ ] Progress bar percentage is calculated as `stepNumber / STEPS.length`.
- [ ] If adding/removing steps, update all `updateInterstitialStep(N, ...)` calls in `handleLoginRedirect`.

### Before Each Release

- [ ] Bump `version` in `manifest.json`.
- [ ] Update `README.md` version footer.
- [ ] Verify no `console.log` calls leak sensitive data (account IDs, tokens, API URLs).
- [ ] Test all nominal and edge cases from `TEST-PLAN.md`.
- [ ] Load unpacked in Chrome and walk through a real login.

---

## 13. Dependency Map

```
manifest.json
 ├── content_scripts[0].js ──► config-loader.js
 │                               └── loadSettings()
 │                                    ├── fetch(config.json)  (read, primary)
 │                                    └── chrome.storage.local  (read, fallback)
 │
 ├── content_scripts[0].js ──► content-script.js
 │                                 ├── loadSettings()  (via config-loader.js)
 │                                 ├── chrome.runtime.sendMessage → service-worker.js
 │                                 ├── chrome.runtime.openOptionsPage → options.html
 │                                 └── document.cookie (read __aid_user_id)
 │
 ├── web_accessible_resources ──► config.json
 │
 ├── background.service_worker ──► service-worker.js
 │                                    ├── chrome.runtime.onMessage (listen)
 │                                    └── fetch → api.atlassian.com
 │
 ├── action.default_popup ──► popup.html
 │                               ├── config-loader.js  (loadSettings)
 │                               └── popup.js
 │                                    ├── loadSettings()  (via config-loader.js)
 │                                    └── chrome.runtime.openOptionsPage
 │
 └── options_page ──► options.html
                        └── options.js
                             └── chrome.storage.local (read/write/delete)
```

### External Dependencies

| Dependency | Version | Notes |
|------------|---------|-------|
| Chrome Extensions API | MV3 | `chrome.runtime`, `chrome.storage`, `chrome.tabs` |
| Atlassian Admin API | v2 | `api.atlassian.com/admin/v2/` |

No npm packages. No build step. No bundler. Pure vanilla JS.

---

## 14. Glossary

| Term | Definition |
|------|-----------|
| **Content Script** | JavaScript that runs in the context of a web page, with access to the DOM but isolated from the page's JS scope. |
| **Service Worker** | MV3 replacement for background pages. Event-driven, no DOM access, can make cross-origin fetch calls. |
| **Interstitial** | The full-screen overlay shown during the group-add process. |
| **`__aid_user_id`** | An Atlassian cookie set during login containing the user's account ID. |
| **`continue` param** | The URL query parameter on `id.atlassian.com/login/authorize` that specifies where to redirect after login. |
| **`navigationBlocked`** | Global flag that prevents the browser from navigating away while the API workflow is in progress. |
| **`loginInProgress`** | Guard flag preventing concurrent execution of `handleLoginRedirect`. |
| **UUID** | Universally Unique Identifier. Format: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`. Used for orgId, directoryId, groupId. |
| **Bearer Token** | An API authentication token passed in the `Authorization: Bearer <token>` header. |
| **Eventual Consistency** | The Atlassian Admin API may not immediately reflect newly-added group memberships, hence the verification polling. |
