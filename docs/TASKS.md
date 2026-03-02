# Project Tasks / Tickets Breakdown

> **Project:** Group Membership Auto-Joiner (Chrome MV3 Extension)
> **Goal:** Build the Atlassian Login Interceptor extension from scratch based on current specifications.

This document breaks down the implementation of the Group Membership Auto-Joiner extension into logical Epics and actionable Tasks. It includes time estimates for a single senior developer and detailed rationales behind each architectural decision.

---

## Epic 1: Extension Scaffolding & Configuration Strategy

**Objective:** Set up the Manifest V3 extension skeleton and build the configuration loading/storage layer.

### 🎫 TASK-101: Create Extension Manifest and Scaffolding
- **Description:** Initialize the Chrome extension with `manifest.json` targeting Manifest V3. Define permissions and scripts.
- **Rationale:** The `manifest.json` is the entry point of the extension. It dictates what permissions we request, which scripts run where, and what the background execution model is. Since we are targeting modern browsers, we must use Manifest V3, which mandates specific security boundaries such as using Service Workers instead of background pages.
- **Estimate:** 0.5 days
- **Acceptance Criteria:**
  - `manifest.json` defines bare minimum details (name, version, MV3).
  - Web accessible resources, host permissions (`id.atlassian.com/login/authorize*`, `api.atlassian.com/*`), and storage permissions are defined.
  - Background service worker, content scripts, and options page definitions are included.

### 🎫 TASK-102: Develop Options Page (UI & Logic)
- **Description:** Create the `options.html` and `options.js` for manual testing and configuration fallback. Securely store inputs.
- **Rationale:** While the extension is primarily deployed via forced admin policy with `config.json`, we need a fallback mechanism and a way to manually test or override settings. Storing tokens and IDs securely in `chrome.storage.local` ensures they do not sync insecurely across devices while giving developers/manual users a reliable interface.
- **Estimate:** 0.5 days
- **Acceptance Criteria:**
  - HTML form includes fields for `orgId`, `directoryId`, `groupId` (validated as UUIDs), and `bearerToken`.
  - JS saves/loads from `chrome.storage.local`.
  - Provide a "Reset" button with confirmation.
  
### 🎫 TASK-103: Implement Admin Config Loader (`config-loader.js`)
- **Description:** Build the priority-based configuration loader to bridge `config.json` and `chrome.storage.local`.
- **Rationale:** To support zero-touch deployments by IT departments, the extension relies on an admin-provided `config.json`. We need a unified loader that prioritizes this file gracefully falling back to local storage if it's missing or incomplete. This abstraction guarantees both the content script and popup share a single source of truth.
- **Estimate:** 0.5 days
- **Acceptance Criteria:**
  - Try fetching `config.json` via `chrome.runtime.getURL()` first.
  - If `config.json` is missing or has missing keys, fallback to `chrome.storage.local`.
  - Return a unified config object or `null` if the configuration is incomplete.

### 🎫 TASK-104: Build Toolbar Popup UI
- **Description:** Create `popup.html` and `popup.js` to visually show extension setup status.
- **Rationale:** Users need a quick visual indicator to understand if the extension is actively configured or if they are missing required setup steps. A simple traffic-light UI (green/red) reduces support tickets and provides an immediate hyperlink to the options page if configuration is needed.
- **Estimate:** 0.5 days
- **Acceptance Criteria:**
  - Status indicator shows "Configured" (Green) or "Not Configured" (Red).
  - Needs to use `config-loader.js` to determine status.
  - Includes a button to navigate to the options page.

---

## Epic 2: Content Script & UI Override Layer

**Objective:** Intercept the login page to inject the UI, extract user data, and block default navigation.

### 🎫 TASK-201: Login Interception & Navigation Blocking
- **Description:** Inject `content-script.js` into `id.atlassian.com/login/authorize` and completely block default browser redirection.
- **Rationale:** We must halt the user on the authorization page long enough to cleanly perform the API call in the background. If we don't intercept `beforeunload` or native page link clicks, the user might be redirected to Jira before the membership addition processes, leaving them without access on their first session.
- **Estimate:** 0.5 days
- **Acceptance Criteria:**
  - Identify when the user lands on the authorization page.
  - Intercept the `beforeunload` event to warn/block page reload.
  - Intercept all `<a>` clicks on the page during processing.

### 🎫 TASK-202: Extract Atlassian Account ID
- **Description:** Scrape the required user ID for the API step from the Atlassian DOM cookies.
- **Rationale:** The Atlassian Admin API requires the user's specific `accountId` to add them to a group. The only location this ID is securely exposed during login without making extraneous API calls is the `__aid_user_id` cookie. This task is purely to reliably extract that dependency before moving forward.
- **Estimate:** 0.5 days
- **Acceptance Criteria:**
  - Read `__aid_user_id` from `document.cookie`.
  - Validate it exists; if missing, fail gracefully.
  - Wait ~100ms before reading to ensure the cookie is set by the page.

### 🎫 TASK-203: Develop Interstitial Overlay Framework
- **Description:** Build the full-screen overlay UI and CSS animations to hide the native login page transition.
- **Rationale:** Pausing a user's login redirection can feel like a hanging application. To provide a premium and informative User Experience, we must inject a native overlay that masks the Atlassian page and clearly communicates the background operations taking place. Real-time visual feedback reduces user confusion and abandonment.
- **Estimate:** 1.0 day
- **Acceptance Criteria:**
  - DOM structure injected natively via content script (fixed fullscreen, z-index 999999).
  - Support a 5-step UI sequence (Pending, Active, Completed, Warning, Error).
  - Include an animated progress bar based on the current step.

---

## Epic 3: API & Service Worker Architecture

**Objective:** Handle external communication with the Atlassian Admin API overcoming CORS limitations.

### 🎫 TASK-301: Setup Service Worker Message Listeners
- **Description:** Establish a message-passing bridge between `content-script.js` and `service-worker.js`.
- **Rationale:** Content Scripts operating in the web page DOM are not allowed to make arbitrary cross-origin fetch requests (CORS restrictions). We must route these requests to a background Service Worker that operates with elevated `host_permissions`. Message passing is the required MV3 IPC mechanism to achieve this.
- **Estimate:** 0.5 days
- **Acceptance Criteria:**
  - Service worker correctly listens to `chrome.runtime.onMessage`.
  - Establish custom 20-second timeout handler in content script for message responses to avoid stalled workers.
  - Keep channels open for async fetches (`return true;`).

### 🎫 TASK-302: API Integration: Add to Group (POST)
- **Description:** Execute the HTTP POST call to the Atlassian API from the background worker.
- **Rationale:** This is the core functionality of the extension. We are automatically inserting the newly logged-in user into the specified Atlassian User Group. Adding an `AbortController` ensures that if the Atlassian API hangs, the user isn't permanently locked out of Jira due to an infinite loading state.
- **Estimate:** 0.5 days
- **Acceptance Criteria:**
  - Send POST request to `/admin/v2/orgs/{orgId}/directories/{directoryId}/groups/{groupId}/memberships`.
  - Include Bearer token and Account ID.
  - Wrap fetch call in an `AbortController` bounded by a 15-second timeout.

### 🎫 TASK-303: API Integration: Verify Membership (GET)
- **Description:** Execute the HTTP GET call to verify if the user was successfully added to the group.
- **Rationale:** The Atlassian Admin API is eventually consistent; a 201 Created on the POST does not immediately mean the user's group privileges are populated. We need a way to confidently know they are a member so we don't redirect them prematurely, guaranteeing they have access the moment the page loads.
- **Estimate:** 0.5 days
- **Acceptance Criteria:**
  - Send GET request to `/admin/v2/orgs/../users?groupIds=...&accountIds=...`.
  - Parse `data` array in the response to determine if `isMember: true` or `false`.
  - Support the same 15-second abort controller logic.

---

## Epic 4: Orchestration, Flow Control & Security

**Objective:** Tie the UI, data, and API together with strong edge-case handling and secure navigation.

### 🎫 TASK-401: Implement Core Login Intercept Flow (State Machine)
- **Description:** Write the master state machine that ties together the 5 steps in `handleLoginRedirect()`.
- **Rationale:** The extension requires a strict chronological sequence. If we try to add to the group before reading settings or extracting the cookie, it fails. We need a centralized orchestrator function that manages the transition between each discrete task, ensuring data flows correctly from step to step.
- **Estimate:** 1.0 day
- **Acceptance Criteria:**
  - Sequences execution: 1. Load Settings -> 2. Extract Cookie -> 3. Add to Group -> 4. Verify Membership -> 5. Redirect.
  - Connect logical steps to Interstitial Overlay updates (update progress bar dynamically).

### 🎫 TASK-402: Verification Polling & Retry Logic
- **Description:** Create the polling mechanism due to API eventual consistency.
- **Rationale:** Since verification (Task 303) is checking an eventually consistent datastore, a single instantaneous check might falsely return `false`. We need to intelligently poll the API with delays to give the backend time to catch up, balancing accuracy with user wait-time.
- **Estimate:** 0.5 days
- **Acceptance Criteria:**
  - Loop up to 5 times with a 2-second delay between verify calls.
  - If verification returns true early, break loop and proceed.
  - If it fails after 5 attempts, mark step with "Warning" status but proceed anyway.

### 🎫 TASK-403: Security: Open Redirect Protection
- **Description:** Ensure the `continueUrl` redirect does not allow phishing attacks.
- **Rationale:** A malicious actor could craft a fake login link with a poisoned `continue=` parameter that redirects the user to a phishing site after the extension unblocks navigation. Parsing and strictly validating the protocol/domain prevents the extension from being leveraged as an open-redirect vulnerability.
- **Estimate:** 0.5 days
- **Acceptance Criteria:**
  - Validate the protocol is exactly `https:`.
  - Validate the hostname matches `*.atlassian.com` or `*.atlassian.net`.
  - Reject redirects if they fail validation and log an error.

### 🎫 TASK-404: Global Error Handling & Recovery Escape Hatches
- **Description:** Catch global errors and assure the user is never stuck in the native login redirect loop.
- **Rationale:** Systems fail (APIs go down, cookies change, tokens expire). It is far better for the extension to fail gracefully, cleanly report the error visually, and redirect the user to Jira anyway (as a standard user), rather than bricking their login flow completely.
- **Estimate:** 1.0 day
- **Acceptance Criteria:**
  - If step 3 (API POST) fails completely (401/403/404), display an error message on the current step.
  - Force a 3-second delay on error, then automatically unblock navigation and redirect so the user still reaches Jira/Confluence.
  - If `Settings Load` fails, redirect user dynamically to extension's Options page.

---

## Epic 5: Quality Assurance & Documentation

**Objective:** Make the code maintainable, documented, and thoroughly tested.

### 🎫 TASK-501: Code Cleanup & Logging Hygiene
- **Description:** Strip PII and secure tokens out of application console logs.
- **Rationale:** Chrome extensions can have their logs inspected by savvy users or support staff. An account ID or Bearer token leaked into `console.log` poses a severe security risk. This ensures compliance with standard security postures and ensures a pristine console.
- **Estimate:** 0.5 days
- **Acceptance Criteria:**
  - No account IDs or tokens console-logged.
  - Only expected error conditions log warnings and red alerts.

### 🎫 TASK-502: User & Admin Documentation writing
- **Description:** Create documentation covering setup, testing, and operations (`README.md`, `QUICKSTART.md`).
- **Rationale:** IT Administrators deploying this software via MDM, and developers maintaining it next year, need robust onboarding materials. The Quickstart allows fast deployment instructions, while the README provides the broader context.
- **Estimate:** 0.5 days
- **Acceptance Criteria:**
  - Write `README.md` and `QUICKSTART.md` for fast admin context.

### 🎫 TASK-503: Technical specification writing (`TECHNICAL.md`)
- **Description:** Document system architecture, storage schemas, and security lifecycles.
- **Rationale:** Manifest V3 lifecycles, service worker interactions, and timeout mitigations are inherently complex to trace just by reading code. High-level architecture docs, Sequence Diagrams, and dependency maps ensure future maintainers understand *why* the code is written the way it is without trial and error.
- **Estimate:** 1.0 day
- **Acceptance Criteria:**
  - Document system architecture in `TECHNICAL.md` (PlantUML, runtime lifecycle).

### 🎫 TASK-504: Test Planning (`TEST-PLAN.md`)
- **Description:** Draft explicit test cases covering happy paths and failure conditions.
- **Rationale:** Given this intercepts a primary authentication boundary, regressions are intolerable. Documented, step-by-step test plans against specific edge-cases (missing cookie, 403 error, success flow, open redirect) standardize the QA process before any deployment.
- **Estimate:** 0.5 days
- **Acceptance Criteria:**
  - Draft `TEST-PLAN.md` with explicit test cases for happy path and error states.

### 🎫 TASK-505: Testing (Manual & Edge Cases Execution)
- **Description:** Execute the regression and testing suite outlined in the Test Plan.
- **Rationale:** Code isn't complete until it's verifiably functioning. Actually performing the QA against the built extension guarantees it satisfies all the constraints, security models, and flow controls defined in the epics.
- **Estimate:** 1.5 days
- **Acceptance Criteria:**
  - Test the built extension against all Edge Cases and Success Flows.
