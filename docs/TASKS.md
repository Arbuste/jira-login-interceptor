# Project Tasks / Tickets Breakdown

> **Project:** Jira Login Interceptor (Forge App + Chrome MV3 Extension)
> **Goal:** Auto-add users to an Atlassian group upon Jira login using a Forge backend and Chrome extension frontend.

All estimates assume a **single senior developer** familiar with Forge, React, and Chrome Extensions.

---

## Epic 1: Forge App Backend — **4.5 days**

**Objective:** Build the Forge app that manages configuration, exposes a webtrigger, and calls the Atlassian Admin API.

### TASK-101: Forge App Scaffolding & Manifest — `0.5 day`

- **Description:** Initialize the Forge app with `manifest.yml`, define admin page, webtrigger, resolver, and permissions.
- **Rationale:** The Forge app is the backend that handles all Atlassian API calls. The manifest defines the app structure, permissions, and entry points.
- **Acceptance Criteria:**
  - `manifest.yml` defines admin page (Custom UI), webtrigger, resolver module
  - External fetch permissions for `https://api.atlassian.com`
  - `storage:app` permission for configuration storage

### TASK-102: Atlassian Admin API Client (`admin-api.ts`) — `2 days`

- **Description:** Build the API client for listing orgs/directories/groups and managing memberships.
- **Rationale:** The Forge app needs to call the Atlassian Admin API v2 to list resources for the admin wizard and to add/verify group membership for the extension.
- **Acceptance Criteria:**
  - `listOrgs()`, `listDirectories(orgId)`, `listGroups(orgId, directoryId)` with cursor-based pagination
  - `addToGroup(orgId, directoryId, groupId, accountId)` — POST membership
  - `verifyMembership(orgId, directoryId, groupId, accountId)` — GET users filtered by group
  - `fetchAllPages()` handles three cursor formats: full URL, query string, bare token
  - ID field fallback: `groupId ?? id`, `directoryId ?? id` for API response compatibility

### TASK-103: Configuration Resolver (`configResolver.ts`) — `1 day`

- **Description:** Implement resolver functions for config CRUD, resource listing, and API key management.
- **Rationale:** The resolver is the bridge between the admin UI (React) and the backend logic. It handles all `invoke()` calls from the frontend.
- **Acceptance Criteria:**
  - `getConfig`/`setConfig` — store orgId, directoryId, groupId
  - `listOrgs`/`listDirectories`/`listGroups` — proxy to admin-api.ts
  - `generateApiKey`/`getApiKey` — create and retrieve the shared API key
  - `getAdminApiKey`/`setAdminApiKey` — manage the Atlassian admin API key
  - `getWebhookUrl` — return the webtrigger URL

### TASK-104: Webtrigger Handler (`webhookHandler.ts`) — `1 day`

- **Description:** Handle incoming HTTP requests from the Chrome extension via the webtrigger.
- **Rationale:** The webtrigger is the only external entry point. It must validate the shared API key and route requests to the correct admin-api functions.
- **Acceptance Criteria:**
  - Validate `Authorization: Bearer <apiKey>` header against stored key
  - Route `addToGroup` and `verifyMembership` actions
  - Return appropriate HTTP status codes and JSON responses

---

## Epic 2: Forge Admin Config UI (React) — **4 days**

**Objective:** Build the admin configuration page with a setup wizard and searchable dropdowns.

### TASK-201: Admin Config Page (`ConfigPage.tsx`) — `1 day`

- **Description:** Build the main admin page that loads config and routes between wizard and overview views.
- **Rationale:** The admin page is the single source of truth for all state. It manages loading of orgs/directories/groups and cascading data fetches.
- **Acceptance Criteria:**
  - Loads existing config on mount
  - Manages state for orgId, directoryId, groupId, hasAdminApiKey, API keys
  - Cascading fetches: admin key → orgs → directories → groups
  - Loading states: `loadingOrgs`, `loadingDirectories`, `loadingGroups`
  - Routes between SetupWizard (unconfigured) and Overview (configured)

### TASK-202: Setup Wizard (`SetupWizard.tsx`) — `1 day`

- **Description:** Implement a 3-step wizard for initial configuration.
- **Rationale:** The wizard guides admins through setup: selecting the target group, generating the extension API key, and reviewing before saving.
- **Acceptance Criteria:**
  - Step 0: StepGroup (org/directory/group selection)
  - Step 1: StepSecurity (generate shared API key)
  - Step 2: StepReview (summary + save)
  - Progress bar showing current step
  - Next/Back navigation with validation (Next disabled until step is complete)

### TASK-203: Searchable Select Component (`SearchableSelect.tsx`) — `1 day`

- **Description:** Build a reusable searchable dropdown component for org/directory/group selection.
- **Rationale:** Plain `<select>` dropdowns don't scale with hundreds of items. Searchable inputs let admins type to filter.
- **Acceptance Criteria:**
  - Text input + filtered dropdown list
  - Client-side filtering by item name
  - Keyboard navigation (ArrowUp/Down, Enter, Escape)
  - Click-outside-to-close
  - Shows selected item name when not focused
  - `onMouseDown` with `preventDefault()` on items to prevent blur before selection

### TASK-204: Step Group Component (`StepGroup.tsx`) — `1 day`

- **Description:** Build wizard step 1: admin API key input and org/directory/group selection.
- **Rationale:** This is the most complex wizard step. It needs to accept the admin API key, show instructions for creating one, and provide three cascading searchable dropdowns.
- **Acceptance Criteria:**
  - Admin API key input with save button
  - Step-by-step instructions for creating an Atlassian org API key
  - Three `SearchableSelect` components for org → directory → group
  - Receives data as props from ConfigPage (no internal fetching)
  - Cascading resets when parent selection changes

---

## Epic 3: Chrome Extension — **5 days**

**Objective:** Build the Chrome MV3 extension that intercepts login and calls the Forge webtrigger.

### TASK-301: Extension Manifest & Scaffolding — `0.5 day`

- **Description:** Create `manifest.json` targeting MV3 with minimal permissions.
- **Acceptance Criteria:**
  - Content scripts injected on `id.atlassian.com/login/authorize*` at `document_start`
  - Service worker registered
  - `config.json` as web-accessible resource
  - Options and popup pages defined

### TASK-302: Config Loader (`config-loader.js`) — `0.5 day`

- **Description:** Build the priority-based configuration loader.
- **Rationale:** chrome.storage.local takes priority (user overrides), with config.json as fallback (bundled defaults).
- **Acceptance Criteria:**
  - Checks `chrome.storage.local` first for `forgeEndpointUrl` and `apiKey`
  - Falls back to `config.json` via `chrome.runtime.getURL()`
  - Returns unified config object or empty object

### TASK-303: Service Worker (`service-worker.js`) — `0.5 day`

- **Description:** Background service that proxies requests to the Forge webtrigger.
- **Acceptance Criteria:**
  - Listens for `makeApiRequest` and `verifyMembership` messages
  - Loads settings via config-loader
  - POSTs to `forgeEndpointUrl` with `Authorization: Bearer <apiKey>`
  - 15-second `AbortController` timeout on all fetches
  - Returns `true` from `onMessage` to keep async channel open

### TASK-304: Content Script (`content-script.js`) — `2 days`

- **Description:** Login interception, interstitial overlay, and 5-step orchestration.
- **Acceptance Criteria:**
  - Detects `id.atlassian.com/login/authorize?continue=...` pages
  - Blocks navigation via `beforeunload` and click handlers
  - Extracts `__aid_user_id` cookie (with 100ms delay)
  - Pre-checks membership (skips overlay if already a member)
  - Shows fullscreen interstitial with 5 progress steps
  - Polls membership verification (5 attempts, 2s apart)
  - 30-second countdown button for manual continue
  - `navigateTo()` validates redirect URL (HTTPS + `*.atlassian.com|net`)
  - Concurrent execution guard (`loginInProgress`)

### TASK-305: Options Page (`options.js` + `options.html`) — `1 day`

- **Description:** Settings page with form, connection test, and drag & drop config import.
- **Acceptance Criteria:**
  - Form for `forgeEndpointUrl` (validated as HTTPS URL) and `apiKey`
  - Save to `chrome.storage.local`
  - Load from storage first, then config.json fallback
  - **Test Connection** button: two-step check (reachability, then API key validation)
  - **Drop zone**: drag & drop `.json` files, validates JSON structure/HTTPS/required fields
  - Clear All button with confirmation
  - Status messages for success/error

### TASK-306: Popup (`popup.js` + `popup.html`) — `0.5 day`

- **Description:** Toolbar popup showing configuration status.
- **Acceptance Criteria:**
  - Green "configured" when both settings present
  - Red "not configured" when either missing
  - Button to open options page

---

## Epic 4: Security & Edge Cases — **1.5 days**

### TASK-401: Open Redirect Protection — `0.5 day`

- **Description:** Validate all redirect URLs before navigation.
- **Acceptance Criteria:**
  - Protocol must be `https:`
  - Hostname must end with `.atlassian.com` or `.atlassian.net`
  - Blocked redirects are logged but don't crash the extension

### TASK-402: Error Handling & Recovery — `0.5 day`

- **Description:** Graceful failure for all error scenarios.
- **Acceptance Criteria:**
  - Missing config → opens options page, redirects after 2s
  - Missing cookie → error overlay, redirects after 3s
  - API failure → error overlay, redirects after 3s
  - Verification exhaustion → amber warning, still redirects
  - Catch-all handler in `handleLoginRedirect`

### TASK-403: Logging Hygiene — `0.5 day`

- **Description:** Remove all sensitive data from console logs.
- **Acceptance Criteria:**
  - No account IDs, tokens, or API URLs in console output
  - Only generic status/error messages remain

---

## Epic 5: Quality Assurance & Documentation — **3 days**

### TASK-501: Documentation — `1 day`

- **Description:** Write README, QUICKSTART, TECHNICAL, EXAMPLES, and TEST-PLAN docs.
- **Acceptance Criteria:**
  - All docs reflect the two-component architecture (Forge + extension)
  - Configuration examples use `forgeEndpointUrl` and `apiKey`
  - Setup instructions cover both Forge admin wizard and extension options page

### TASK-502: Test Execution — `2 days`

- **Description:** Execute all test cases from TEST-PLAN.md.
- **Acceptance Criteria:**
  - All nominal, error, security, and edge case tests pass
  - Test results documented

---

## Summary

| Epic | Estimate |
|------|----------|
| Epic 1: Forge App Backend | 4.5 days |
| Epic 2: Forge Admin Config UI | 4 days |
| Epic 3: Chrome Extension | 5 days |
| Epic 4: Security & Edge Cases | 1.5 days |
| Epic 5: QA & Documentation | 3 days |
| **Total** | **18 days** |

> Note: Epics 1–2 (backend + UI) and Epic 3 (extension) can be parallelized if a second developer is available, reducing the critical path to ~10.5 days. Epic 4 tasks are best done inline with Epics 3 (TASK-401/402/403 overlap with content script and service worker work).

**Last Updated**: 2026-03-03
