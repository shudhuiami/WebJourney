# WebJourney — Privacy Policy & Data Safety Disclosures (WJ-503)

*Effective Date: September 2026*  
*Version 1.0*

WebJourney ("we", "our", or "the Extension") is dedicated to protecting user privacy. This policy outlines our data handling practices and our explicit non-collection guarantees.

---

## 1. Core Principle: Zero Sensitive Data Retention
WebJourney guides learners through real tasks on live websites. Unlike web analytics or screen recording tools:
- **No Keystroke / Input Capture**: We do **not** record, log, transmit, or store text typed into form fields, passwords, credit card details, or authentication credentials.
- **No Session Credentials**: Session cookies, Bearer tokens, and HTTP request headers are never read or stored.
- **No Arbitrary DOM Harvesting**: Full webpage HTML source code and user browsing histories are never collected or scraped.

---

## 2. Information Handled Locally
- **Target Fingerprints**: Scoped CSS selectors, tag names, and accessibility labels used exclusively to locate UI elements during interactive walkthroughs.
- **Journey Configurations**: User-authored instructions, step titles, and allowed website origins saved locally in Chrome Storage (`chrome.storage.local`).
- **Run Progress**: Temporary tracking of the active step index to support pause/resume functionality across page navigation and reloads.

---

## 3. Chrome Extension Permissions Justification

| Permission | Technical Justification |
| :--- | :--- |
| `activeTab` | Required to highlight targets and mount the isolated Shadow DOM overlay only on tabs where the user explicitly activates WebJourney. |
| `sidePanel` | Required to display the Visual Journey Builder and Step Customizer alongside the active website. |
| `storage` | Required to persist local drafts, published version snapshots, and active progress in `chrome.storage.local`. |
| `scripting` | Required to inject the isolated overlay content script into user-approved origins. |

---

## 4. Third-Party Sharing & Telemetry
WebJourney does not sell, rent, or monetize user data. All draft journey data remains entirely on the user's local device until the user explicitly exports or publishes a version.

---

## 5. Contact & Support
For privacy inquiries or technical support:  
- **Developer**: Ahmed Zobayer  
- **Email**: zobayer.me@gmail.com
