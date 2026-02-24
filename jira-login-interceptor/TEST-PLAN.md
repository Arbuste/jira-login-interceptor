# Test Plan — Group Membership Auto-Joiner

> Version: 3.0
> Last updated: 2026-02-24

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Nominal Cases](#2-nominal-cases)
3. [Configuration & Options Page](#3-configuration--options-page)
4. [Popup](#4-popup)
5. [Error Cases](#5-error-cases)
6. [Security & Edge Cases](#6-security--edge-cases)
7. [Timeout & Resilience](#7-timeout--resilience)
8. [Concurrency & Race Conditions](#8-concurrency--race-conditions)
9. [Interstitial Overlay UI](#9-interstitial-overlay-ui)
10. [Config File (config.json)](#10-config-file-configjson)
11. [Storage](#11-storage)
12. [Service Worker Lifecycle](#12-service-worker-lifecycle)

---

## 1. Prerequisites

### Environment

- Chrome or Chromium-based browser (version 110+)
- Extension loaded unpacked from the `jira-login-interceptor/` directory
- Access to an Atlassian organization with Admin API v2 access
- Valid orgId, directoryId, groupId (UUIDs), and a bearer token with group management permissions
- A Jira/Confluence instance that uses `id.atlassian.com` for login

### Tools

- Chrome DevTools (F12) — Console, Network, Application tabs
- `chrome://extensions/` — for reloading the extension and inspecting the service worker
- cURL or Postman — for verifying API responses independently

### Notation

- **PASS**: Expected behavior observed.
- **FAIL**: Actual behavior deviates from expected.
- Each test has a unique ID (e.g., `NOM-01`) for traceability.

---

## 2. Nominal Cases

### NOM-01: Successful login with group add and verified membership

| | |
|---|---|
| **Preconditions** | Extension configured with valid orgId, directoryId, groupId, bearerToken. User is NOT already in the target group. |
| **Steps** | 1. Navigate to the Jira/Confluence login page.<br>2. Log in with valid credentials.<br>3. Observe the browser redirecting to `id.atlassian.com/login/authorize?continue=...`. |
| **Expected** | 1. Full-screen dark overlay appears with "Setting up your access".<br>2. Steps progress: Login detected (green) → Account ID extracted (green) → Adding to group (green) → Verifying membership (green, "Membership confirmed!") → Redirecting (green, "All done!").<br>3. Progress bar fills to 100% (green).<br>4. Browser redirects to the original Jira/Confluence URL.<br>5. Console shows no account IDs, no API URLs, no cookie values. |

### NOM-02: Successful login, user already in group

| | |
|---|---|
| **Preconditions** | Extension configured. User IS already in the target group. |
| **Steps** | Same as NOM-01. |
| **Expected** | Same flow as NOM-01. The POST to add-to-group may return 409 Conflict or succeed idempotently (depends on Atlassian API behavior). If 409, step 3 should show an error. If idempotent success, all steps green. Verify which response the API returns and document it. |

### NOM-03: Successful login, verification eventually confirms membership

| | |
|---|---|
| **Preconditions** | Extension configured. API has eventual consistency delay (membership not immediately visible). |
| **Steps** | Same as NOM-01. |
| **Expected** | Step 4 may take multiple polling attempts (up to 5 x 2s = 10s). The spinner on step 4 should remain active during polling. Eventually turns green with "Membership confirmed!". |

### NOM-04: Successful login, verification cannot confirm membership

| | |
|---|---|
| **Preconditions** | Extension configured. Membership verification returns `false` for all 5 attempts (e.g., severe API lag). |
| **Steps** | Same as NOM-01. |
| **Expected** | 1. Steps 1-3: green checkmarks.<br>2. Step 4: amber/yellow warning icon with exclamation mark. Label turns amber. Status message: "Could not confirm membership. Redirecting anyway...".<br>3. Progress bar stays green (does NOT turn red).<br>4. Step 5: proceeds normally, redirects to destination. |

---

## 3. Configuration & Options Page

### OPT-01: Save valid settings

| | |
|---|---|
| **Steps** | 1. Open options page (right-click extension → Options).<br>2. Enter valid UUID for orgId, directoryId, groupId.<br>3. Enter a bearer token.<br>4. Click "Save Settings". |
| **Expected** | Green success message: "Settings saved successfully!". Message disappears after 5 seconds. |

### OPT-02: Save with empty fields

| | |
|---|---|
| **Steps** | 1. Open options page.<br>2. Leave one or more fields empty.<br>3. Click "Save Settings". |
| **Expected** | Red error message: "Please fill in all required fields (*)". Settings are NOT saved. |

### OPT-03: Save with invalid orgId (not a UUID)

| | |
|---|---|
| **Steps** | 1. Enter `not-a-uuid` in the Organization ID field.<br>2. Fill other fields with valid values.<br>3. Click "Save Settings". |
| **Expected** | Red error: "Organization ID does not appear to be a valid UUID". |

### OPT-04: Save with invalid directoryId (not a UUID)

| | |
|---|---|
| **Steps** | 1. Enter `12345` in the Directory ID field.<br>2. Fill other fields with valid values.<br>3. Click "Save Settings". |
| **Expected** | Red error: "Directory ID does not appear to be a valid UUID". |

### OPT-05: Save with invalid groupId (not a UUID)

| | |
|---|---|
| **Steps** | 1. Enter `abc` in the Group ID field.<br>2. Fill other fields with valid values.<br>3. Click "Save Settings". |
| **Expected** | Red error: "Group ID does not appear to be a valid UUID". |

### OPT-06: Load previously saved settings

| | |
|---|---|
| **Preconditions** | Settings were saved in OPT-01. |
| **Steps** | 1. Close the options page.<br>2. Reopen it. |
| **Expected** | All 4 fields are pre-filled with the previously saved values. |

### OPT-07: Reset all settings

| | |
|---|---|
| **Steps** | 1. Open options page with saved settings.<br>2. Click "Clear All".<br>3. Confirm the dialog. |
| **Expected** | All 4 fields are empty. Success message: "All settings cleared". |

### OPT-08: Cancel reset

| | |
|---|---|
| **Steps** | 1. Open options page with saved settings.<br>2. Click "Clear All".<br>3. Click "Cancel" in the confirm dialog. |
| **Expected** | Settings remain unchanged. No status message. |

---

## 4. Popup

### POP-01: Popup shows configured status

| | |
|---|---|
| **Preconditions** | All 4 settings are saved. |
| **Steps** | Click the extension icon in the toolbar. |
| **Expected** | Green status: "Extension configured and active". |

### POP-02: Popup shows not-configured status

| | |
|---|---|
| **Preconditions** | One or more settings are missing. |
| **Steps** | Click the extension icon. |
| **Expected** | Red status: "Extension not configured. Please set up your group membership settings." |

### POP-03: Configure button opens options page

| | |
|---|---|
| **Steps** | 1. Click extension icon.<br>2. Click "Configure Settings". |
| **Expected** | Options page opens in a new tab. |

### POP-04: "Open Settings Page" link opens options page

| | |
|---|---|
| **Steps** | 1. Click extension icon.<br>2. Click "Open Settings Page" link at the bottom. |
| **Expected** | Options page opens in a new tab. Default link behavior is prevented (no `#` navigation). |

---

## 5. Error Cases

### ERR-01: Extension not configured

| | |
|---|---|
| **Preconditions** | No settings saved (or partially configured). |
| **Steps** | Log in to Jira. |
| **Expected** | 1. Overlay appears.<br>2. Step 1 turns red with "Extension not configured. Opening settings...".<br>3. Options page opens automatically.<br>4. After 2 seconds, browser redirects to Jira (unblocked). |

### ERR-02: Cookie not found

| | |
|---|---|
| **Preconditions** | Extension configured. `__aid_user_id` cookie is not set (e.g., non-standard login flow). |
| **Steps** | Navigate to `https://id.atlassian.com/login/authorize?continue=https://xxx.atlassian.net/` without actually logging in (or with cookies cleared). |
| **Expected** | 1. Step 1: green.<br>2. Step 2: red, "Could not extract user account ID. Redirecting...".<br>3. After 3 seconds, redirects to the continue URL. |

### ERR-03: API returns 401 (unauthorized)

| | |
|---|---|
| **Preconditions** | Extension configured with an invalid/expired bearer token. |
| **Steps** | Log in to Jira. |
| **Expected** | 1. Steps 1-2: green.<br>2. Step 3: red, "Failed to add to group: API request failed with status 401: ...". <br>3. After 3 seconds, redirects. |

### ERR-04: API returns 403 (forbidden)

| | |
|---|---|
| **Preconditions** | Bearer token lacks group management permissions. |
| **Steps** | Log in to Jira. |
| **Expected** | Same as ERR-03 but with status 403. |

### ERR-05: API returns 404 (wrong IDs)

| | |
|---|---|
| **Preconditions** | orgId, directoryId, or groupId is a valid UUID but doesn't exist. |
| **Steps** | Log in to Jira. |
| **Expected** | Step 3: red, "Failed to add to group: API request failed with status 404: ...". Redirects after 3s. |

### ERR-06: Network error (no connectivity)

| | |
|---|---|
| **Preconditions** | Extension configured. Network disabled or `api.atlassian.com` unreachable. |
| **Steps** | Log in to Jira (with login page already cached/loaded). |
| **Expected** | Step 3: red, "Failed to add to group: Failed to fetch" (or similar network error). Redirects after 3s. |

### ERR-07: Verification attempt errors (partial failures)

| | |
|---|---|
| **Preconditions** | API intermittently fails during verification calls. |
| **Steps** | Log in to Jira. Simulate by throttling network or using a proxy to fail some requests. |
| **Expected** | Console shows `console.warn` for failed attempts. Verification continues to next attempt. If any attempt succeeds, step 4 turns green. If all 5 fail, step 4 shows amber warning. |

---

## 6. Security & Edge Cases

### SEC-01: Open redirect — malicious continue URL (external domain)

| | |
|---|---|
| **Steps** | Navigate to `https://id.atlassian.com/login/authorize?continue=https://evil-phishing-site.com/steal-creds`. |
| **Expected** | 1. Extension flow runs normally through steps 1-5.<br>2. At step 5, `navigateTo()` blocks the redirect.<br>3. Console logs: "Blocked redirect to untrusted URL: https://evil-phishing-site.com/steal-creds".<br>4. Browser does NOT navigate to `evil-phishing-site.com`. |

### SEC-02: Open redirect — HTTP (non-HTTPS) continue URL

| | |
|---|---|
| **Steps** | Navigate to `https://id.atlassian.com/login/authorize?continue=http://mysite.atlassian.net/`. |
| **Expected** | Redirect blocked. Console: "Blocked redirect to untrusted URL". Even though the domain is Atlassian, HTTP is not allowed. |

### SEC-03: Open redirect — javascript: protocol

| | |
|---|---|
| **Steps** | Navigate to `https://id.atlassian.com/login/authorize?continue=javascript:alert(1)`. |
| **Expected** | `new URL('javascript:alert(1)')` may throw or produce a URL with non-https protocol. Either way, redirect is blocked. |

### SEC-04: Open redirect — data: protocol

| | |
|---|---|
| **Steps** | Navigate with `continue=data:text/html,<script>alert(1)</script>`. |
| **Expected** | Redirect blocked (protocol is not `https:`). |

### SEC-05: Open redirect — valid Atlassian subdomain

| | |
|---|---|
| **Steps** | Navigate with `continue=https://mycompany.atlassian.net/jira/software/projects/PROJ/boards/1`. |
| **Expected** | Redirect is ALLOWED. This is a legitimate Atlassian URL. |

### SEC-06: Open redirect — domain spoofing (evil-atlassian.com)

| | |
|---|---|
| **Steps** | Navigate with `continue=https://evil-atlassian.com/`. |
| **Expected** | Redirect blocked. `evil-atlassian.com` does not end with `.atlassian.com`. |

### SEC-07: Open redirect — subdomain attack (atlassian.com.evil.com)

| | |
|---|---|
| **Steps** | Navigate with `continue=https://atlassian.com.evil.com/`. |
| **Expected** | Redirect blocked. Hostname `atlassian.com.evil.com` does not end with `.atlassian.com` (it ends with `.evil.com`). |

### SEC-08: No sensitive data in console logs

| | |
|---|---|
| **Steps** | 1. Open DevTools Console (F12).<br>2. Log in to Jira and let the extension complete its flow.<br>3. Search console output for account IDs, API URLs with path params, cookie values, or bearer tokens. |
| **Expected** | None found. Only generic status messages, warnings, and errors are logged. |

### SEC-09: Bearer token not visible in popup or extension pages

| | |
|---|---|
| **Steps** | 1. Configure extension with a bearer token.<br>2. Open popup — verify token is not displayed.<br>3. Open options page — verify token field is `type="password"`. |
| **Expected** | Token is masked in the options page input. Not displayed in the popup at all. |

### SEC-10: No continue parameter

| | |
|---|---|
| **Steps** | Navigate to `https://id.atlassian.com/login/authorize` (no `?continue=` parameter). |
| **Expected** | Extension does nothing. No overlay, no API calls. Page loads normally. |

---

## 7. Timeout & Resilience

### TMO-01: Service worker fetch timeout (15s)

| | |
|---|---|
| **Preconditions** | Simulate a hanging API by using Chrome DevTools Network throttling (set to "Offline" after the login page loads, or block `api.atlassian.com` via a proxy). |
| **Steps** | Log in to Jira. |
| **Expected** | After ~15 seconds, step 3 shows red error (AbortError or fetch error). Redirects after 3s. Total wait: ~18s. |

### TMO-02: Service worker message timeout (20s)

| | |
|---|---|
| **Preconditions** | Force the service worker to crash: go to `chrome://extensions/`, find the extension, click "service worker" link, and in the service worker DevTools run `self.close()` or terminate it. |
| **Steps** | Log in to Jira immediately after killing the service worker. |
| **Expected** | After ~20 seconds, `sendMessageWithTimeout` rejects. Current active step turns red with "Error: Service worker did not respond. Redirecting...". Browser redirects after 3s. |

### TMO-03: Verification polling exhaustion

| | |
|---|---|
| **Preconditions** | API consistently returns empty `data` array for membership check (user added to group but not yet visible). |
| **Steps** | Log in to Jira. |
| **Expected** | Step 4 spinner runs for ~10s (5 attempts x 2s delay). Then shows amber warning. Step 5 proceeds. User lands on Jira. |

---

## 8. Concurrency & Race Conditions

### RACE-01: Navigation blocked before setTimeout fires

| | |
|---|---|
| **Steps** | Log in to Jira. During the 100ms delay (before `handleLoginRedirect` runs), try to click a link on the page. |
| **Expected** | Click is intercepted (`navigationBlocked` was set to `true` in `checkAndHandleLoginPage`, before the `setTimeout`). The link click is prevented. |

### RACE-02: Concurrent execution guard

| | |
|---|---|
| **Steps** | Programmatically (via DevTools console) call `handleLoginRedirect('https://test.atlassian.net/')` twice rapidly. |
| **Expected** | The second call returns immediately (no-op) because `loginInProgress === true`. Only one overlay is shown. Only one set of API calls is made. |

### RACE-03: beforeunload during API call

| | |
|---|---|
| **Steps** | 1. Log in to Jira.<br>2. While the overlay is showing (during steps 2-4), try to close the tab or navigate away via the address bar. |
| **Expected** | Browser shows a "Leave site?" confirmation dialog (from `beforeunload` handler). If the user stays, the flow continues normally. |

### RACE-04: Double page load (SPA-style navigation)

| | |
|---|---|
| **Steps** | If Atlassian's login page does a client-side redirect that re-triggers the content script. |
| **Expected** | `loginInProgress` guard prevents a second execution. `createInterstitialOverlay()` is idempotent (returns existing overlay). |

---

## 9. Interstitial Overlay UI

### UI-01: Overlay covers entire page

| | |
|---|---|
| **Steps** | Log in to Jira. Observe the overlay. |
| **Expected** | Dark overlay covers the entire viewport. No page content visible beneath. z-index 999999 ensures it's on top. |

### UI-02: Step progression animation

| | |
|---|---|
| **Steps** | Watch the overlay during a successful login. |
| **Expected** | Each step transitions smoothly: number → spinner (blue, rotating) → checkmark (green). Transitions use CSS `transition: all 0.3s ease`. |

### UI-03: Progress bar fills correctly

| | |
|---|---|
| **Steps** | Watch the progress bar during a successful 5-step flow. |
| **Expected** | Bar fills in 20% increments: 20% → 40% → 60% → 80% → 100%. Green gradient throughout. Smooth `transition: width 0.5s ease`. |

### UI-04: Progress bar turns red on error

| | |
|---|---|
| **Steps** | Trigger an error at step 3 (e.g., invalid token). |
| **Expected** | Progress bar fills to 40% (step 2 completed), then turns red gradient when step 3 errors. Bar does NOT advance to 60%. |

### UI-05: Warning status displays correctly

| | |
|---|---|
| **Steps** | Trigger a scenario where verification fails after 5 attempts (NOM-04). |
| **Expected** | Step 4 shows amber circle with `!` icon. Label text turns amber (#d29922). Progress bar stays green and advances normally. Status message turns amber. |

### UI-06: Status message updates

| | |
|---|---|
| **Steps** | Watch the status message area below the progress bar during the flow. |
| **Expected** | Message changes at each step: "This usually takes a few seconds" → "Detecting login..." → "Extracting account ID..." → etc. Error messages appear in red. Warning messages in amber. |

---

## 10. Config File (config.json)

### CFG-01: Config pre-filled — settings loaded from config.json

| | |
|---|---|
| **Preconditions** | `config.json` has all 4 values filled. `chrome.storage.local` is empty. |
| **Steps** | 1. Load extension.<br>2. Log in to Jira. |
| **Expected** | Extension uses config.json values. Flow completes normally. Options page never opens. |

### CFG-02: Config empty — falls back to chrome.storage.local

| | |
|---|---|
| **Preconditions** | `config.json` has all values as empty strings. `chrome.storage.local` has valid settings. |
| **Steps** | 1. Load extension.<br>2. Log in to Jira. |
| **Expected** | Extension skips config.json (empty values) and uses chrome.storage.local values. Flow completes normally. |

### CFG-03: Config partially filled — falls back to chrome.storage.local

| | |
|---|---|
| **Preconditions** | `config.json` has only `orgId` filled, rest empty. `chrome.storage.local` has valid settings. |
| **Steps** | 1. Load extension.<br>2. Log in to Jira. |
| **Expected** | Extension skips config.json (incomplete) and uses chrome.storage.local values. |

### CFG-04: Config corrupt (invalid JSON) — falls back gracefully

| | |
|---|---|
| **Preconditions** | `config.json` contains invalid JSON (e.g., `{bad`). `chrome.storage.local` has valid settings. |
| **Steps** | 1. Load extension.<br>2. Log in to Jira. |
| **Expected** | `loadSettings()` catches the parse error, falls back to chrome.storage.local. No crash. Flow completes normally. |

### CFG-05: Config missing (deleted) — falls back gracefully

| | |
|---|---|
| **Preconditions** | `config.json` file is deleted from the extension directory. `chrome.storage.local` has valid settings. |
| **Steps** | 1. Load extension.<br>2. Log in to Jira. |
| **Expected** | `loadSettings()` catches the fetch error, falls back to chrome.storage.local. No crash. Flow completes normally. |

### CFG-06: Both config.json and storage empty — not configured

| | |
|---|---|
| **Preconditions** | `config.json` has empty values. `chrome.storage.local` is empty. |
| **Steps** | 1. Load extension.<br>2. Log in to Jira. |
| **Expected** | Extension is not configured. Options page opens. User is redirected after 2 seconds. |

### CFG-07: Popup reflects config.json status

| | |
|---|---|
| **Preconditions** | `config.json` has all 4 values filled. `chrome.storage.local` is empty. |
| **Steps** | Click the extension icon in the toolbar. |
| **Expected** | Popup shows green "Extension configured and active" (loaded from config.json). |

### CFG-08: Options page still works as fallback

| | |
|---|---|
| **Preconditions** | `config.json` has empty values. |
| **Steps** | 1. Open options page.<br>2. Enter valid settings and save.<br>3. Log in to Jira. |
| **Expected** | Extension uses chrome.storage.local values from options page. Flow completes normally. |

---

## 11. Storage (chrome.storage.local)

### STG-01: Settings persist across browser restart

| | |
|---|---|
| **Steps** | 1. Save settings in options page.<br>2. Close and reopen Chrome.<br>3. Open options page. |
| **Expected** | All 4 settings are still present. |

### STG-02: Settings are stored in chrome.storage.local (not sync)

| | |
|---|---|
| **Steps** | 1. Save settings.<br>2. Open DevTools on options page → Application tab → Storage → Extension Storage (or run `chrome.storage.local.get(null, console.log)` in the extension's DevTools console). |
| **Expected** | All 4 keys visible in local storage. `chrome.storage.sync.get(null, console.log)` returns empty for these keys. |

### STG-03: Clearing settings removes all keys

| | |
|---|---|
| **Steps** | 1. Save settings.<br>2. Click "Clear All" and confirm.<br>3. Verify storage via DevTools. |
| **Expected** | All 4 keys are removed from `chrome.storage.local`. |

### STG-04: Partial settings treated as not configured

| | |
|---|---|
| **Steps** | 1. Save all 4 settings.<br>2. Manually remove one key via DevTools: `chrome.storage.local.remove('groupId')`.<br>3. Log in to Jira. |
| **Expected** | Extension treats this as "not configured" (ERR-01 flow). Options page opens. Popup shows "not configured". |

---

## 12. Service Worker Lifecycle

### SW-01: Service worker initializes on extension load

| | |
|---|---|
| **Steps** | 1. Load/reload the extension at `chrome://extensions/`.<br>2. Click the "service worker" link to open its DevTools. |
| **Expected** | Console shows: "Group Membership Auto-Joiner service worker initialized". |

### SW-02: Service worker handles messages after wake-up

| | |
|---|---|
| **Steps** | 1. Wait >30 seconds for the service worker to go idle (it may be terminated by Chrome).<br>2. Log in to Jira. |
| **Expected** | Chrome automatically wakes the service worker on `chrome.runtime.sendMessage`. API calls succeed normally. |

### SW-03: Service worker crash recovery

| | |
|---|---|
| **Steps** | 1. Open service worker DevTools, run `throw new Error('crash')` or terminate it.<br>2. Log in to Jira immediately. |
| **Expected** | Either: (a) Chrome restarts the service worker in time and the flow succeeds, or (b) the 20-second message timeout fires and the user sees an error, then gets redirected. |

---

## Summary Matrix

| Area | Test IDs | Count |
|------|----------|-------|
| Nominal (happy path) | NOM-01 to NOM-04 | 4 |
| Options page | OPT-01 to OPT-08 | 8 |
| Popup | POP-01 to POP-04 | 4 |
| Error cases | ERR-01 to ERR-07 | 7 |
| Security | SEC-01 to SEC-10 | 10 |
| Timeouts | TMO-01 to TMO-03 | 3 |
| Race conditions | RACE-01 to RACE-04 | 4 |
| Overlay UI | UI-01 to UI-06 | 6 |
| Config file | CFG-01 to CFG-08 | 8 |
| Storage | STG-01 to STG-04 | 4 |
| Service worker | SW-01 to SW-03 | 3 |
| **Total** | | **61** |
