# Technical Documentation — Jira Login Interceptor

> Version: 4.0
> Last updated: 2026-03-02

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
13. [Glossary](#13-glossary)

---

## 1. Architecture Overview

The system has two main components:

```
┌─────────────────────────────────────────────────────────────┐
│  Browser (Chrome / Chromium)                                │
│                                                             │
│  ┌──────────────────────┐  ┌────────────────────────────┐   │
│  │  Content Script       │  │  Service Worker             │   │
│  │  (config-loader.js    │  │  (service-worker.js)        │   │
│  │   + content-script.js)│  │  - Proxies to Forge         │   │
│  │  - Intercepts login   │──│    webtrigger               │   │
│  │  - Shows overlay      │  │  - 15s fetch timeout        │   │
│  │  - Extracts cookie    │  │                             │   │
│  └──────────────────────┘  └─────────────┬──────────────┘   │
│                                           │                  │
│  ┌──────────────┐  ┌──────────────┐       │                  │
│  │  Popup       │  │  Options     │       │                  │
│  │  (popup.js)  │  │  (options.js)│       │                  │
│  └──────────────┘  └──────────────┘       │                  │
│                                           │                  │
│  ┌─────────────────┐ ┌────────────────┐   │                  │
│  │  config.json     │ │chrome.storage  │   │                  │
│  │  (bundled)       │ │.local          │   │                  │
│  │  forgeEndpointUrl│ │forgeEndpointUrl│   │                  │
│  │  apiKey          │ │apiKey          │   │                  │
│  └─────────────────┘ └────────────────┘   │                  │
└───────────────────────────────────────────┼──────────────────┘
                                            │ HTTPS POST
                                            ▼
┌─────────────────────────────────────────────────────────────┐
│  Forge App (Atlassian Cloud)                                │
│                                                             │
│  ┌──────────────────────┐  ┌────────────────────────────┐   │
│  │  Webtrigger          │  │  Admin Config UI (React)    │   │
│  │  (webhookHandler.ts) │  │  - Setup wizard             │   │
│  │  - addToGroup        │  │  - Searchable dropdowns     │   │
│  │  - verifyMembership  │  │  - API key management       │   │
│  └──────────┬───────────┘  └────────────────────────────┘   │
│             │                                               │
│  ┌──────────▼───────────┐  ┌────────────────────────────┐   │
│  │  admin-api.ts        │  │  Forge App Storage          │   │
│  │  - Atlassian API v2  │  │  - orgId, directoryId       │   │
│  │  - Cursor pagination │  │  - groupId, adminApiKey     │   │
│  │  - Add/verify member │  │  - apiKey (shared)          │   │
│  └──────────┬───────────┘  └────────────────────────────┘   │
│             │                                               │
└─────────────┼───────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────┐
│  Atlassian Admin API v2     │
│  api.atlassian.com          │
└─────────────────────────────┘
```

### Key Design Decisions

- **Extension never touches Atlassian API directly** — all API calls go through the Forge webtrigger. This keeps the Atlassian Admin API key server-side only.
- **Config priority: storage first, config.json fallback** — user-saved settings in `chrome.storage.local` override bundled `config.json` defaults.
- **Client-side filtering for searchable dropdowns** — all orgs/directories/groups are fetched upfront with pagination, then filtered in the browser. Server-side search was considered but abandoned due to Forge fetch permission constraints.

---

## 2. File Inventory

### Chrome Extension (`jira-login-interceptor/`)

| File | Role | Notes |
|------|------|-------|
| `manifest.json` | Extension manifest (MV3) | Permissions, content scripts, service worker |
| `config.json` | Admin-provided config | `{ forgeEndpointUrl, apiKey }` — bundled defaults |
| `js/config-loader.js` | Shared settings loader | `loadSettings()`: chrome.storage.local first, config.json fallback |
| `js/content-script.js` | Login detection & UI | Injected into `id.atlassian.com/login/authorize*` |
| `js/service-worker.js` | Forge proxy | Forwards requests to Forge webtrigger |
| `js/options.js` | Settings page logic | Save/load, connection test, drag & drop config import |
| `js/popup.js` | Popup logic | Status indicator using `loadSettings()` |
| `pages/options.html` | Settings page markup | Drop zone + form for forgeEndpointUrl and apiKey |
| `pages/popup.html` | Popup markup | Status + link to settings |

### Forge App (`forge-app/`)

| File | Role | Notes |
|------|------|-------|
| `manifest.yml` | Forge manifest | Admin page, webtrigger, resolver, permissions |
| `src/admin-api.ts` | Atlassian Admin API client | `listOrgs`, `listDirectories`, `listGroups`, `addToGroup`, `verifyMembership`, cursor-based `fetchAllPages` |
| `src/handlers/configResolver.ts` | Resolver functions | `getConfig`/`setConfig`, `listOrgs`/`listDirectories`/`listGroups`, `generateApiKey`/`getApiKey`, `getAdminApiKey`/`setAdminApiKey`, `getWebhookUrl` |
| `src/handlers/webhookHandler.ts` | Webtrigger handler | Validates API key, routes `addToGroup`/`verifyMembership` |
| `admin-config/src/ConfigPage.tsx` | Admin UI root | Loads config, manages state, routes wizard vs overview |
| `admin-config/src/SetupWizard.tsx` | 3-step wizard | Step 0: Group, Step 1: Security, Step 2: Review |
| `admin-config/src/components/StepGroup.tsx` | Wizard step 1 | Admin API key input + searchable org/directory/group dropdowns |
| `admin-config/src/components/SearchableSelect.tsx` | Searchable dropdown | Client-side filtering, keyboard nav, click-outside-close |
| `admin-config/src/utils.ts` | Shared utilities | `resolveDisplayName(list, id)` |
| `admin-config/src/types.ts` | TypeScript types | `AdminResource`, `AppConfig`, etc. |
| `admin-config/src/styles.css` | Admin UI styles | Searchable select, spinner, wizard, overview |

---

## 3. Runtime Lifecycle

### 3.1 Extension Load

1. Chrome loads `manifest.json`.
2. Service worker (`service-worker.js`) is registered.
3. Content script injection rule: inject `config-loader.js` then `content-script.js` on `https://id.atlassian.com/login/authorize*` at `document_start`.

### 3.2 Login Interception (Happy Path)

```
User logs in to Jira
  → Browser redirects to id.atlassian.com/login/authorize?continue=...
  → Content script injected at document_start

1. checkAndHandleLoginPage()
   - navigationBlocked = true
   - setTimeout(100ms) to wait for cookies

2. handleLoginRedirect(continueUrl)
   - loginInProgress = true
   - loadSettings() → { forgeEndpointUrl, apiKey }

3. Pre-check: is user already a member?
   - sendMessage({ action: 'verifyMembership', accountId })
   - If yes → skip overlay, redirect immediately

4. createInterstitialOverlay() — 5 steps:
   Step 1: Login detected ✓
   Step 2: Extract __aid_user_id cookie ✓
   Step 3: Add to group (POST to Forge webtrigger) ✓
   Step 4: Verify membership (poll up to 5x, 2s apart) ✓
   Step 5: Redirect to continueUrl ✓

5. navigateTo(continueUrl) — validated against allowlist
```

### 3.3 Service Worker Message Flow

```
content-script.js
  → chrome.runtime.sendMessage({ action, accountId, ... })
  → service-worker.js receives message
  → Loads settings (forgeEndpointUrl, apiKey)
  → fetch(forgeEndpointUrl, {
      method: 'POST',
      headers: { Authorization: 'Bearer <apiKey>', Content-Type: 'application/json' },
      body: { action: 'addToGroup'|'verifyMembership', accountId }
    })
  → Returns response to content script
```

### 3.4 Forge Webtrigger Flow

```
Extension → POST webtrigger URL
  → webhookHandler.ts validates API key
  → Routes action to admin-api.ts
  → admin-api.ts calls Atlassian Admin API v2 using stored config + admin API key
  → Returns result to extension
```

### 3.5 Service Worker Lifecycle (MV3)

The service worker is event-driven and may be terminated by Chrome after ~30s of inactivity. It wakes on `chrome.runtime.onMessage`. The content script uses a 20-second message timeout (`sendMessageWithTimeout`). All fetch calls have a 15-second `AbortController` timeout.

### 3.6 Page Unload Prevention

While `navigationBlocked === true`:
- `beforeunload` handler calls `event.preventDefault()` and sets `event.returnValue`.
- Click handler on `document` (capture phase) intercepts all `<a>` clicks.

---

## 4. Component Deep-Dive

### 4.1 content-script.js

#### Global State

| Variable | Type | Purpose |
|----------|------|---------|
| `navigationBlocked` | `boolean` | Blocks `beforeunload` and link clicks |
| `overlayElement` | `HTMLElement\|null` | Reference to interstitial overlay |
| `loginInProgress` | `boolean` | Concurrent execution guard |
| `STEPS` | `Array<{label}>` | 5-step definitions for the overlay |

#### Key Functions

| Function | Purpose |
|----------|---------|
| `checkAndHandleLoginPage()` | Entry point. Parses URL, validates login page, starts flow. |
| `handleLoginRedirect(continueUrl)` | Orchestrates the 5-step process. Guarded by `loginInProgress`. |
| `sendMessageWithTimeout(message, timeoutMs)` | Wraps `chrome.runtime.sendMessage` with Promise + timeout (20s default). |
| `createInterstitialOverlay()` | Builds/injects fullscreen overlay. Idempotent. |
| `updateInterstitialStep(stepNumber, status, message)` | Updates step icon, color, progress bar. |
| `extractAccountId()` | Reads `__aid_user_id` from `document.cookie`. |
| `verifyGroupMembership(...)` | Polls service worker up to 5 times, 2s apart. |
| `navigateTo(url)` | Validates URL (HTTPS + `*.atlassian.com\|net`), then redirects. |

### 4.2 service-worker.js

Listens for messages via `chrome.runtime.onMessage`:

| Action | HTTP | Forge Endpoint Body |
|--------|------|---------------------|
| `makeApiRequest` | POST | `{ action: 'addToGroup', accountId }` |
| `verifyMembership` | POST | `{ action: 'verifyMembership', accountId }` |

Both use `AbortController` with 15-second timeout:
```js
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 15000);
const response = await fetch(forgeEndpointUrl, { ..., signal: controller.signal });
clearTimeout(timeoutId);
```

### 4.3 config-loader.js

Single async function `loadSettings()`:

1. `chrome.storage.local.get(['forgeEndpointUrl', 'apiKey'])` — if both present, return.
2. `fetch(chrome.runtime.getURL('config.json'))` — parse, if both keys present, return.
3. Otherwise return `{}` (not configured).

### 4.4 options.js

- **Load**: On `DOMContentLoaded`, reads from chrome.storage.local, then falls back to config.json.
- **Save**: Validates forgeEndpointUrl (must be HTTPS, valid URL) and apiKey (non-empty). Writes to chrome.storage.local.
- **Test Connection**: Two-step check:
  1. Endpoint reachability (POST without auth — any response including 401 means reachable)
  2. API key validation (POST with `Authorization: Bearer <key>` — 401 = bad key, 200 = good)
- **Drop Zone**: Accepts `.json` files. Validates JSON structure, HTTPS URL, required fields. Populates form fields.
- **Reset**: Confirms, then removes both keys from chrome.storage.local.

### 4.5 popup.js

Calls `loadSettings()`. If both `forgeEndpointUrl` and `apiKey` are present → green "configured". Otherwise → red "not configured". Button opens options page.

### 4.6 Forge Admin Config UI

**ConfigPage.tsx** — Single source of truth for all state:
- Loads existing config on mount (orgId, directoryId, groupId, hasAdminApiKey, apiKey)
- Cascading data loading: admin API key → orgs → directories → groups
- Loading states: `loadingOrgs`, `loadingDirectories`, `loadingGroups`
- Passes everything to SetupWizard → StepGroup as props

**SearchableSelect.tsx** — Reusable searchable dropdown:
- Text input + filtered dropdown list
- Client-side filtering by item name
- Keyboard navigation (ArrowUp/Down, Enter, Escape)
- Click-outside-to-close (document mousedown listener)
- `onMouseDown` with `e.preventDefault()` on items to prevent blur before selection registers

**StepGroup.tsx** — Wizard step 1:
- Admin API key input with step-by-step creation instructions
- Three `SearchableSelect` components for org/directory/group
- Receives all data and loading states as props (no internal fetching)

---

## 5. Message Protocol

### content-script.js → service-worker.js

Both message types are forwarded to the Forge webtrigger as POST requests.

#### `makeApiRequest`

**Content script sends:**
```json
{ "action": "makeApiRequest", "accountId": "5f7c..." }
```

**Service worker calls Forge:**
```
POST <forgeEndpointUrl>
Authorization: Bearer <apiKey>
Content-Type: application/json
{ "action": "addToGroup", "accountId": "5f7c..." }
```

**Response (success):** `{ "success": true }`
**Response (failure):** `{ "success": false, "error": "..." }`

#### `verifyMembership`

**Content script sends:**
```json
{ "action": "verifyMembership", "accountId": "5f7c..." }
```

**Service worker calls Forge:**
```
POST <forgeEndpointUrl>
Authorization: Bearer <apiKey>
Content-Type: application/json
{ "action": "verifyMembership", "accountId": "5f7c..." }
```

**Response:** `{ "isMember": true }` or `{ "isMember": false }`

---

## 6. Security Model

### 6.1 API Key Separation

- **Atlassian Admin API key** — stored only in Forge app storage. Never exposed to the Chrome extension or end users.
- **Shared API key** — generated by the Forge app, stored in both Forge storage (for validation) and the Chrome extension (for authentication). This is the only secret the extension handles.

### 6.2 Open Redirect Protection

`navigateTo(url)` validates:
1. `parsed.protocol === 'https:'`
2. `parsed.hostname` ends with `.atlassian.com` or `.atlassian.net`

### 6.3 Token Storage

Extension settings stored in `chrome.storage.local` (on-device only, not synced).

### 6.4 Host Permissions (Least Privilege)

```json
"host_permissions": [
  "https://id.atlassian.com/login/authorize*"
]
```

The Forge webtrigger URL is dynamically fetched from settings, not hardcoded in permissions.

### 6.5 Input Validation

- `forgeEndpointUrl` validated as a valid HTTPS URL on save
- `apiKey` validated as non-empty
- JSON files dropped on the drop zone are validated for structure and HTTPS URL
- `continueUrl` validated by `navigateTo()` before redirect

### 6.6 Logging Hygiene

No account IDs, tokens, or full API URLs are logged. Only generic status messages and errors.

---

## 7. Timeouts & Retry Strategy

| Layer | Timeout | Mechanism | On Timeout |
|-------|---------|-----------|------------|
| Service worker fetch | 15s | `AbortController` | Throws `AbortError`, returned as error |
| Content script → service worker | 20s | `setTimeout` + `Promise.reject` | Error overlay, redirects after 3s |
| Membership verification | 5 attempts x 2s | Loop with `sendMessageWithTimeout` | Amber warning, still redirects |
| Cookie extraction delay | 100ms | `setTimeout` | Ensures cookie is set |
| Manual continue button | 30s countdown | Button appears in overlay | User can click to proceed |

### Worst-Case Timeline

If Forge endpoint is completely down:
1. 100ms cookie delay
2. Step 3 (add to group): 20s message timeout → error → 3s delay → redirect

**Total worst case: ~23 seconds** before redirect.

---

## 8. Storage Schema

### Chrome Extension

**chrome.storage.local** (primary):

| Key | Type | Example |
|-----|------|---------|
| `forgeEndpointUrl` | string (HTTPS URL) | `https://...atlassian.net/x1/...` |
| `apiKey` | string | `abc123...` |

**config.json** (fallback):

```json
{
  "forgeEndpointUrl": "https://your-forge-webtrigger-url",
  "apiKey": "your-shared-api-key"
}
```

### Forge App Storage

| Key | Value |
|-----|-------|
| `orgId` | Organization UUID |
| `directoryId` | Directory UUID |
| `groupId` | Group UUID |
| `adminApiKey` | Atlassian Admin API key (encrypted via `forge variables`) |
| `apiKey` | Shared API key (for extension auth) |

### Configuration Priority

```
loadSettings()
  ├── chrome.storage.local has both keys? → use it
  ├── config.json has both keys? → use it
  └── neither? → return {} (not configured)
```

---

## 9. Interstitial Overlay

### DOM Structure

```
#jli-interstitial (fixed fullscreen, z-index: 999999)
  └── card (centered container)
      ├── h2 "Setting up your access"
      ├── p "Please wait while we configure..."
      ├── #jli-steps
      │   ├── #jli-step-1 → .jli-step-icon + .jli-step-label
      │   ├── #jli-step-2
      │   ├── #jli-step-3
      │   ├── #jli-step-4
      │   └── #jli-step-5
      ├── progress track
      │   └── #jli-progress (animated width bar)
      ├── #jli-status (status message text)
      └── continue button (appears after 30s countdown)
```

### Step Statuses

| Status | Icon | Icon BG | Progress Bar |
|--------|------|---------|-------------|
| `pending` | Number | `#21262d` | No change |
| `active` | Spinning SVG | `#1f6feb` | Advances |
| `completed` | Checkmark SVG | `#238636` | Advances |
| `warning` | Exclamation SVG | `#9e6a03` | Stays green |
| `error` | X SVG | `#da3633` | Turns red |

---

## 10. Error Handling & Recovery

| Error | Step | Recovery |
|-------|------|----------|
| Extension not configured | 1 | Options page opens, redirects after 2s |
| Cookie not found | 2 | Error overlay, redirects after 3s |
| Forge endpoint unreachable | 3 | Error overlay, redirects after 3s |
| API key invalid (401) | 3 | Error overlay, user reconfigures |
| Forge app not configured (500) | 3 | Error overlay, admin completes wizard |
| Verification fails 5x | 4 | Amber warning, still redirects |
| Untrusted redirect URL | 5 | Redirect silently blocked |
| Any unexpected exception | Active step | Step turns red, redirects after 3s |

The outer `catch` block in `handleLoginRedirect` finds the currently-active step, marks it as `error`, waits 3s, then unblocks navigation and redirects. The `finally` block always resets `loginInProgress = false`.

---

## 11. Known Constraints & Limitations

1. **Single group only**: One group per installation. Multi-group would require array support.
2. **Cookie dependency**: `__aid_user_id` must be set by Atlassian's login flow. Non-standard SSO may not set it.
3. **MV3 service worker lifecycle**: May be terminated at any time. The 20s message timeout handles this.
4. **No offline support**: Requires network access to the Forge endpoint.
5. **Verification polling**: Up to ~10s in the success case (5 attempts x 2s).
6. **Browser support**: Chrome/Chromium only.
7. **Client-side filtering only**: Searchable dropdowns fetch all items and filter locally. Very large orgs (1000+ groups) may experience slower initial load.
8. **Forge fetch permissions**: The Forge app can only fetch from `https://api.atlassian.com`. Adding query params to paginated URLs must stay within this domain.

---

## 12. Maintenance Checklist

### When Updating the Forge App

- [ ] Check Atlassian Admin API endpoint changes
- [ ] Verify `manifest.yml` permissions cover any new endpoints
- [ ] Run `npx tsc --noEmit` for type checking
- [ ] Run `npx vite build` for frontend build
- [ ] `forge deploy` and test

### When Changing Extension Storage Keys

- [ ] Update `config.json` schema
- [ ] Update `config-loader.js` (both paths)
- [ ] Update `options.js` (load, save, reset, drop zone validation)
- [ ] Update `popup.js` (status check)
- [ ] Update `content-script.js` and `service-worker.js`
- [ ] Update this document

### When Modifying the Interstitial

- [ ] `STEPS` array in `content-script.js` defines step count and labels
- [ ] `updateInterstitialStep()` handles visual states
- [ ] Progress bar percentage = `stepNumber / STEPS.length`
- [ ] Update all `updateInterstitialStep(N, ...)` calls

### Before Each Release

- [ ] Bump `version` in `manifest.json`
- [ ] Verify no `console.log` calls leak sensitive data
- [ ] Test all cases from `TEST-PLAN.md`
- [ ] Load unpacked in Chrome and walk through a real login

---

## 13. Glossary

| Term | Definition |
|------|-----------|
| **Forge App** | An Atlassian cloud app deployed via the Forge platform. Runs server-side on Atlassian infrastructure. |
| **Webtrigger** | A Forge feature that exposes an HTTP endpoint callable from outside Atlassian. |
| **Content Script** | JS running in the context of a web page, with DOM access but isolated scope. |
| **Service Worker** | MV3 background process. Event-driven, no DOM, can make cross-origin fetches. |
| **Interstitial** | The fullscreen overlay shown during the group-add process. |
| **`__aid_user_id`** | Atlassian cookie set during login containing the user's account ID. |
| **`continue` param** | URL query parameter on `id.atlassian.com/login/authorize` specifying the post-login redirect. |
| **Shared API Key** | Secret generated by Forge app, used by the extension to authenticate with the webtrigger. |
| **Admin API Key** | Atlassian organization admin API key, stored only in Forge. Used to call the Admin API v2. |
| **SearchableSelect** | React component providing a text input with filtered dropdown list. |
| **Client-side filtering** | All items fetched upfront, filtered in the browser by name match. |
| **Cursor-based pagination** | Atlassian API pagination using `links.next` cursors rather than page numbers. |
