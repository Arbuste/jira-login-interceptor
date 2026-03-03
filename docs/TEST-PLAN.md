# Test Plan — Jira Login Interceptor

> Version: 4.0
> Last updated: 2026-03-02

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Nominal Cases](#2-nominal-cases)
3. [Extension Options Page](#3-extension-options-page)
4. [Popup](#4-popup)
5. [Error Cases](#5-error-cases)
6. [Security & Edge Cases](#6-security--edge-cases)
7. [Timeout & Resilience](#7-timeout--resilience)
8. [Concurrency & Race Conditions](#8-concurrency--race-conditions)
9. [Interstitial Overlay UI](#9-interstitial-overlay-ui)
10. [Config File & Storage](#10-config-file--storage)
11. [Service Worker Lifecycle](#11-service-worker-lifecycle)
12. [Forge Admin Config UI](#12-forge-admin-config-ui)
13. [Connection Test](#13-connection-test)
14. [Drag & Drop Config Import](#14-drag--drop-config-import)

---

## 1. Prerequisites

### Environment

- Chrome or Chromium-based browser (version 110+)
- Extension loaded unpacked from `jira-login-interceptor/`
- Forge app deployed and installed on a Jira site
- Forge admin wizard completed (org/directory/group configured, API key generated)
- Extension configured with Forge webtrigger URL and shared API key
- A Jira/Confluence instance using `id.atlassian.com` for login

### Tools

- Chrome DevTools (F12) — Console, Network, Application tabs
- `chrome://extensions/` — reload extension, inspect service worker
- Forge CLI — `forge logs` for backend debugging

### Notation

- **PASS**: Expected behavior observed.
- **FAIL**: Actual behavior deviates from expected.

---

## 2. Nominal Cases

### NOM-01: Successful login with group add and verified membership

| | |
|---|---|
| **Preconditions** | Extension configured. User NOT in the target group. |
| **Steps** | 1. Navigate to Jira login page.<br>2. Log in with valid credentials.<br>3. Observe redirect to `id.atlassian.com/login/authorize?continue=...`. |
| **Expected** | 1. Fullscreen overlay appears with "Setting up your access".<br>2. Steps progress: Login detected → Account ID extracted → Adding to group → Verifying membership → Redirecting.<br>3. All steps turn green. Progress bar fills to 100%.<br>4. Browser redirects to Jira. |

### NOM-02: User already in group (pre-check bypass)

| | |
|---|---|
| **Preconditions** | Extension configured. User IS already in the target group. |
| **Steps** | Same as NOM-01. |
| **Expected** | Pre-check detects existing membership. No overlay shown. User is redirected immediately to Jira. |

### NOM-03: Verification eventually confirms membership

| | |
|---|---|
| **Preconditions** | Extension configured. API has eventual consistency delay. |
| **Steps** | Same as NOM-01. |
| **Expected** | Step 4 polls multiple times (up to 5 x 2s). Spinner stays active during polling. Eventually turns green. |

### NOM-04: Verification cannot confirm after 5 attempts

| | |
|---|---|
| **Preconditions** | Extension configured. Membership not visible to API within timeout. |
| **Steps** | Same as NOM-01. |
| **Expected** | Step 4 shows amber warning. Progress bar stays green. Step 5 proceeds. User lands on Jira. |

---

## 3. Extension Options Page

### OPT-01: Save valid settings

| | |
|---|---|
| **Steps** | 1. Open options page.<br>2. Enter valid HTTPS URL for Forge Endpoint.<br>3. Enter API key.<br>4. Click "Save Settings". |
| **Expected** | Green message: "Settings saved successfully!". Disappears after 5s. |

### OPT-02: Save with empty fields

| | |
|---|---|
| **Steps** | Leave one or both fields empty. Click "Save Settings". |
| **Expected** | Red error: "Please fill in all required fields (*)". Not saved. |

### OPT-03: Save with non-HTTPS URL

| | |
|---|---|
| **Steps** | Enter `http://example.com` as Forge Endpoint URL. Click "Save Settings". |
| **Expected** | Red error: "Forge Endpoint URL must use HTTPS". |

### OPT-04: Save with invalid URL

| | |
|---|---|
| **Steps** | Enter `not-a-url` as Forge Endpoint URL. Click "Save Settings". |
| **Expected** | Red error: "Forge Endpoint URL is not a valid URL". |

### OPT-05: Load previously saved settings

| | |
|---|---|
| **Preconditions** | Settings saved in OPT-01. |
| **Steps** | Close and reopen options page. |
| **Expected** | Both fields pre-filled with saved values. |

### OPT-06: Load from config.json when storage empty

| | |
|---|---|
| **Preconditions** | `chrome.storage.local` is empty. `config.json` has valid values. |
| **Steps** | Open options page. |
| **Expected** | Fields populated from config.json. Message: "Loaded from config.json. Click 'Save Settings' to persist." |

### OPT-07: Clear all settings

| | |
|---|---|
| **Steps** | 1. Open options with saved settings.<br>2. Click "Clear All".<br>3. Confirm dialog. |
| **Expected** | Fields empty. Message: "All settings cleared". |

### OPT-08: Cancel clear

| | |
|---|---|
| **Steps** | Click "Clear All" then "Cancel" in dialog. |
| **Expected** | Settings unchanged. No message. |

---

## 4. Popup

### POP-01: Configured status

| | |
|---|---|
| **Preconditions** | Both settings present (storage or config.json). |
| **Steps** | Click extension icon. |
| **Expected** | Green "Extension configured and active". |

### POP-02: Not configured status

| | |
|---|---|
| **Preconditions** | One or both settings missing. |
| **Steps** | Click extension icon. |
| **Expected** | Red "Extension not configured" message. |

### POP-03: Configure button opens options

| | |
|---|---|
| **Steps** | Click extension icon → "Configure Settings". |
| **Expected** | Options page opens in new tab. |

---

## 5. Error Cases

### ERR-01: Extension not configured

| | |
|---|---|
| **Preconditions** | No settings saved anywhere. |
| **Steps** | Log in to Jira. |
| **Expected** | Overlay step 1 turns red: "Extension not configured. Opening settings...". Options page opens. Redirects after 2s. |

### ERR-02: Cookie not found

| | |
|---|---|
| **Preconditions** | Extension configured. `__aid_user_id` cookie not set. |
| **Steps** | Navigate to `id.atlassian.com/login/authorize?continue=...` without logging in. |
| **Expected** | Step 2 turns red: "Could not extract user account ID". Redirects after 3s. |

### ERR-03: Forge endpoint unreachable

| | |
|---|---|
| **Preconditions** | Extension configured with wrong URL or Forge app not deployed. |
| **Steps** | Log in to Jira. |
| **Expected** | Step 3 turns red: "Failed to add to group: Failed to fetch". Redirects after 3s. |

### ERR-04: Invalid API key (401)

| | |
|---|---|
| **Preconditions** | Extension configured with wrong shared API key. |
| **Steps** | Log in to Jira. |
| **Expected** | Step 3 turns red with 401 error. Redirects after 3s. |

### ERR-05: Forge app not configured (500)

| | |
|---|---|
| **Preconditions** | Forge app deployed but wizard not completed. |
| **Steps** | Log in to Jira. |
| **Expected** | Step 3 turns red with 500 error ("not configured"). Redirects after 3s. |

### ERR-06: Network error during verification

| | |
|---|---|
| **Preconditions** | API intermittently fails during verification. |
| **Steps** | Log in. Simulate by throttling network. |
| **Expected** | Console warns for failed attempts. Verification continues. If any attempt succeeds → green. If all 5 fail → amber warning. |

---

## 6. Security & Edge Cases

### SEC-01: Open redirect — external domain

| | |
|---|---|
| **Steps** | Navigate with `continue=https://evil-site.com/steal`. |
| **Expected** | Redirect blocked. Console logs: "Blocked redirect to untrusted URL". |

### SEC-02: Open redirect — HTTP URL

| | |
|---|---|
| **Steps** | Navigate with `continue=http://mysite.atlassian.net/`. |
| **Expected** | Blocked. HTTP not allowed even for Atlassian domains. |

### SEC-03: Open redirect — javascript: protocol

| | |
|---|---|
| **Steps** | Navigate with `continue=javascript:alert(1)`. |
| **Expected** | Blocked (protocol is not `https:`). |

### SEC-04: Open redirect — data: protocol

| | |
|---|---|
| **Steps** | Navigate with `continue=data:text/html,...`. |
| **Expected** | Blocked. |

### SEC-05: Valid Atlassian subdomain allowed

| | |
|---|---|
| **Steps** | Navigate with `continue=https://mycompany.atlassian.net/jira/...`. |
| **Expected** | Redirect ALLOWED. |

### SEC-06: Domain spoofing (evil-atlassian.com)

| | |
|---|---|
| **Steps** | Navigate with `continue=https://evil-atlassian.com/`. |
| **Expected** | Blocked. Does not end with `.atlassian.com`. |

### SEC-07: Subdomain attack (atlassian.com.evil.com)

| | |
|---|---|
| **Steps** | Navigate with `continue=https://atlassian.com.evil.com/`. |
| **Expected** | Blocked. Ends with `.evil.com`, not `.atlassian.com`. |

### SEC-08: No sensitive data in console

| | |
|---|---|
| **Steps** | Open DevTools, log in, search console for account IDs, API URLs, tokens. |
| **Expected** | None found. |

### SEC-09: API key masked in options page

| | |
|---|---|
| **Steps** | Configure extension. Open options page. |
| **Expected** | API key field is `type="password"`. Not visible in popup. |

### SEC-10: No continue parameter

| | |
|---|---|
| **Steps** | Navigate to `id.atlassian.com/login/authorize` with no `?continue=`. |
| **Expected** | Extension does nothing. No overlay, no API calls. |

---

## 7. Timeout & Resilience

### TMO-01: Service worker fetch timeout (15s)

| | |
|---|---|
| **Preconditions** | Block network to Forge endpoint after page loads. |
| **Steps** | Log in to Jira. |
| **Expected** | After ~15s, step 3 shows red error. Redirects after 3s. |

### TMO-02: Service worker message timeout (20s)

| | |
|---|---|
| **Preconditions** | Terminate service worker via DevTools. |
| **Steps** | Log in immediately after. |
| **Expected** | After ~20s, error shown. Redirects after 3s. |

### TMO-03: Verification polling exhaustion

| | |
|---|---|
| **Preconditions** | API consistently returns `isMember: false`. |
| **Steps** | Log in. |
| **Expected** | Step 4 spinner for ~10s (5 x 2s). Amber warning. Redirects normally. |

### TMO-04: Manual continue button (30s countdown)

| | |
|---|---|
| **Steps** | Log in. Wait 30 seconds without the flow completing. |
| **Expected** | A "Continue" button appears. Clicking it redirects immediately. |

---

## 8. Concurrency & Race Conditions

### RACE-01: Navigation blocked before setTimeout

| | |
|---|---|
| **Steps** | During 100ms delay, click a link on the page. |
| **Expected** | Click prevented (`navigationBlocked = true` before setTimeout). |

### RACE-02: Concurrent execution guard

| | |
|---|---|
| **Steps** | Call `handleLoginRedirect()` twice via DevTools. |
| **Expected** | Second call is a no-op (`loginInProgress === true`). |

### RACE-03: beforeunload during API call

| | |
|---|---|
| **Steps** | During overlay steps 2-4, try to close tab. |
| **Expected** | Browser shows "Leave site?" dialog. |

### RACE-04: Double page load

| | |
|---|---|
| **Steps** | Client-side redirect re-triggers content script. |
| **Expected** | `loginInProgress` guard prevents second execution. Overlay is idempotent. |

---

## 9. Interstitial Overlay UI

### UI-01: Overlay covers entire page

| | |
|---|---|
| **Expected** | Dark overlay covers full viewport. z-index 999999. No page content visible. |

### UI-02: Step progression animation

| | |
|---|---|
| **Expected** | Steps transition: number → spinner (blue) → checkmark (green). Smooth CSS transitions. |

### UI-03: Progress bar fills correctly

| | |
|---|---|
| **Expected** | Bar fills in 20% increments (5 steps). Green gradient. Smooth transition. |

### UI-04: Progress bar turns red on error

| | |
|---|---|
| **Expected** | Bar fills to the errored step percentage, then turns red. Does not advance further. |

### UI-05: Warning status (amber)

| | |
|---|---|
| **Expected** | Step 4 amber circle with `!` icon. Label turns amber. Bar stays green. |

### UI-06: Status messages update

| | |
|---|---|
| **Expected** | Message updates at each step. Errors in red. Warnings in amber. |

---

## 10. Config File & Storage

### CFG-01: Storage takes priority over config.json

| | |
|---|---|
| **Preconditions** | `chrome.storage.local` has values. `config.json` has different values. |
| **Steps** | Log in to Jira. |
| **Expected** | Extension uses chrome.storage.local values. |

### CFG-02: Config.json used when storage empty

| | |
|---|---|
| **Preconditions** | `chrome.storage.local` empty. `config.json` has valid values. |
| **Steps** | Log in to Jira. |
| **Expected** | Extension uses config.json values. Flow completes. |

### CFG-03: Config.json corrupt — falls back gracefully

| | |
|---|---|
| **Preconditions** | `config.json` has invalid JSON. `chrome.storage.local` has values. |
| **Steps** | Log in. |
| **Expected** | Uses storage values. No crash. |

### CFG-04: Both sources empty — not configured

| | |
|---|---|
| **Preconditions** | `chrome.storage.local` empty. `config.json` empty. |
| **Steps** | Log in. |
| **Expected** | ERR-01 flow: options page opens, redirects after 2s. |

### CFG-05: Settings persist across browser restart

| | |
|---|---|
| **Steps** | Save settings. Restart Chrome. Open options page. |
| **Expected** | Settings still present. |

### CFG-06: Storage uses local (not sync)

| | |
|---|---|
| **Steps** | Save settings. Check DevTools Application tab. |
| **Expected** | Keys in `chrome.storage.local`. Not in `chrome.storage.sync`. |

---

## 11. Service Worker Lifecycle

### SW-01: Service worker initializes on load

| | |
|---|---|
| **Steps** | Load/reload extension. Open service worker DevTools. |
| **Expected** | Initialization log visible in console. |

### SW-02: Handles messages after wake-up

| | |
|---|---|
| **Steps** | Wait >30s for worker to idle. Log in to Jira. |
| **Expected** | Chrome wakes worker. API calls succeed. |

### SW-03: Crash recovery

| | |
|---|---|
| **Steps** | Terminate worker in DevTools. Log in immediately. |
| **Expected** | Either worker restarts in time, or 20s timeout fires and user sees error then redirects. |

---

## 12. Forge Admin Config UI

### FORGE-01: Setup wizard — enter admin API key

| | |
|---|---|
| **Steps** | Open Forge admin page. Enter valid admin API key. Click "Save API Key". |
| **Expected** | Key saved. Org dropdown populates with searchable items. |

### FORGE-02: Searchable dropdown — type to filter

| | |
|---|---|
| **Steps** | Click org dropdown. Type partial name. |
| **Expected** | Dropdown filters items by typed text. Matching items shown. |

### FORGE-03: Searchable dropdown — keyboard navigation

| | |
|---|---|
| **Steps** | Open dropdown. Use ArrowDown/ArrowUp. Press Enter. |
| **Expected** | Highlighted item moves. Enter selects it. Dropdown closes. |

### FORGE-04: Searchable dropdown — click outside closes

| | |
|---|---|
| **Steps** | Open dropdown. Click elsewhere on the page. |
| **Expected** | Dropdown closes. |

### FORGE-05: Cascading selection

| | |
|---|---|
| **Steps** | Select org → directories load. Select directory → groups load. |
| **Expected** | Each subsequent dropdown populates after parent selection. Previous dependent selections reset. |

### FORGE-06: Generate API key

| | |
|---|---|
| **Steps** | Complete Step 1. Go to Step 2. Click "Generate API Key". |
| **Expected** | Key generated and displayed. Copy button works. |

### FORGE-07: Save configuration

| | |
|---|---|
| **Steps** | Complete all 3 steps. Click "Save Configuration". |
| **Expected** | Config saved. Page switches to overview showing webtrigger URL and API key. |

### FORGE-08: Loading spinner

| | |
|---|---|
| **Steps** | Open admin page while config is loading. |
| **Expected** | Spinner shown with "Loading configuration..." text. Disappears when loaded. |

---

## 13. Connection Test

### CONN-01: All good — endpoint reachable and key valid

| | |
|---|---|
| **Preconditions** | Valid Forge URL and API key. Forge app fully configured. |
| **Steps** | Click "Test Connection" on options page. |
| **Expected** | Green: "All good! Endpoint reachable, API key valid, Forge app configured." |

### CONN-02: Endpoint unreachable

| | |
|---|---|
| **Preconditions** | Invalid URL or Forge app not deployed. |
| **Steps** | Click "Test Connection". |
| **Expected** | Red: "Endpoint unreachable: ..." |

### CONN-03: API key invalid

| | |
|---|---|
| **Preconditions** | Valid URL, wrong API key. |
| **Steps** | Click "Test Connection". |
| **Expected** | Red: "Endpoint reachable, but the API key is invalid." |

### CONN-04: Forge app not configured

| | |
|---|---|
| **Preconditions** | Valid URL and key, but wizard not completed. |
| **Steps** | Click "Test Connection". |
| **Expected** | Red: "Endpoint reachable and API key valid, but the Forge app is not fully configured yet..." |

---

## 14. Drag & Drop Config Import

### DROP-01: Valid config.json dropped

| | |
|---|---|
| **Steps** | Drop a valid JSON file with `forgeEndpointUrl` (HTTPS) and `apiKey`. |
| **Expected** | Fields populated. Green flash on drop zone. Message: "Config imported. Click 'Save Settings' to persist." |

### DROP-02: Non-JSON file dropped

| | |
|---|---|
| **Steps** | Drop a `.txt` file. |
| **Expected** | Red flash on drop zone. Error: "Please drop a .json file." |

### DROP-03: Invalid JSON content

| | |
|---|---|
| **Steps** | Drop a `.json` file with invalid JSON syntax. |
| **Expected** | Red flash. Error: "Invalid JSON file." |

### DROP-04: Missing required fields

| | |
|---|---|
| **Steps** | Drop a `.json` with `{ "foo": "bar" }`. |
| **Expected** | Red flash. Error listing missing/invalid fields. |

### DROP-05: Non-HTTPS URL in dropped file

| | |
|---|---|
| **Steps** | Drop a `.json` with `{ "forgeEndpointUrl": "http://example.com", "apiKey": "abc" }`. |
| **Expected** | Red flash. Error: "forgeEndpointUrl must use HTTPS". |

### DROP-06: Click to browse

| | |
|---|---|
| **Steps** | Click the drop zone. |
| **Expected** | File picker opens. Selecting a valid `.json` populates fields. |

### DROP-07: Drag over visual feedback

| | |
|---|---|
| **Steps** | Drag a file over the drop zone (without dropping). |
| **Expected** | Drop zone border changes color (dragover state). Returns to normal on drag leave. |

---

## Summary Matrix

| Area | Test IDs | Count |
|------|----------|-------|
| Nominal (happy path) | NOM-01 to NOM-04 | 4 |
| Options page | OPT-01 to OPT-08 | 8 |
| Popup | POP-01 to POP-03 | 3 |
| Error cases | ERR-01 to ERR-06 | 6 |
| Security | SEC-01 to SEC-10 | 10 |
| Timeouts | TMO-01 to TMO-04 | 4 |
| Race conditions | RACE-01 to RACE-04 | 4 |
| Overlay UI | UI-01 to UI-06 | 6 |
| Config & storage | CFG-01 to CFG-06 | 6 |
| Service worker | SW-01 to SW-03 | 3 |
| Forge admin UI | FORGE-01 to FORGE-08 | 8 |
| Connection test | CONN-01 to CONN-04 | 4 |
| Drag & drop | DROP-01 to DROP-07 | 7 |
| **Total** | | **73** |
