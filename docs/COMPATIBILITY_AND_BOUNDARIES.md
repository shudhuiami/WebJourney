# WebJourney — Compatibility, Browser Boundaries & Non-Goals (WJ-001)

## 1. Browser & Platform Targets
- **Primary Target**: Google Chrome Desktop (Version 116+)
  - Chrome 116+ is required for full, stable support of the `chrome.sidePanel` API alongside Manifest V3 service workers.
  - Future expansion: Chromium-based desktop browsers (Edge, Brave, Opera, Arc).
  - Explicit Non-Goals for Launch: Firefox, Safari, and mobile web browsers.

---

## 2. Permission Model & User Consent UX
- **Least-Privilege by Design**:
  - The extension defaults to `activeTab` and only interacts with the page the user explicitly activates.
  - When authoring or running a journey on a new website domain, the user is presented with a clear consent confirmation:
    > *"Allow WebJourney to guide you on [hostname]?"*
  - No `<all_urls>` persistent background tracking.
  - Quick toggle to pause or deactivate the extension globally at any time from the extension popup.

---

## 3. DOM Boundaries & Host Isolation

### 3.1 Shadow DOM Overlay Isolation
- The WebJourney player and inspector overlay are rendered inside a closed/open Shadow Root (`#webjourney-host` -> `attachShadow({ mode: "open" })`).
- All styles (CSS resets, font definitions, tooltips, spotlights) are strictly encapsulated inside the Shadow Root.
- **Outcome**: The host website's stylesheets cannot break WebJourney's UI, and WebJourney's styles never pollute or deform the host page layout.

### 3.2 Iframes & Embedded Elements
- **Same-Origin Iframes**: Supported when content scripts have access.
- **Cross-Origin Iframes**: Explicitly marked as **unsupported** for MVP due to browser sandbox restrictions preventing parent extensions from piercing third-party security boundaries.
- **Canvas / WebGL UIs**: Canvas-rendered components (e.g. Figma canvas, Google Maps viewport, games) lack standard DOM nodes and are explicitly out-of-scope for element-level targeting.
- **Browser Native Controls**: File upload pickers, print dialogs, and browser address bars cannot be targeted by extensions.

---

## 4. Privacy, Security & Data Boundaries

### 4.1 Strict Zero-Capture Policy for User Inputs
- **Field-Complete Steps**: WebJourney monitors only DOM lifecycle events (`input`, `change`, `blur`) to observe that a field has been completed (e.g. `element.value.length > 0`).
- **Never Logged or Uploaded**:
  - Typed text strings (especially passwords, card numbers, personal data).
  - Session cookies or `Authorization` headers.
  - Full-page DOM innerHTML scrapes.

### 4.2 Safe Execution
- **No Arbitrary Code Injection**: Journey definitions consist strictly of declarative JSON schemas. No `eval()`, `new Function()`, or custom script injection is permitted.
- **Sanitized Guidance Text**: All instruction titles and markdown bodies are sanitized before rendering inside the Shadow DOM tooltip to prevent stored XSS attacks.
