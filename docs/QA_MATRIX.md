# WebJourney — QA Verification & Accessibility Matrix (WJ-502)

This matrix outlines all test scenarios, expected results, and verification evidence across desktop environments.

---

## 1. Functional Test Scenarios

| Test ID | Scenario | Expected Behavior | Status |
| :--- | :--- | :--- | :--- |
| **TC-01** | Visual Element Hover & Pick | Outlines hovered elements with selector badge; captures stable target on click. | Passed |
| **TC-02** | Click Step Action | Overlay spots target; advances only when learner clicks the exact element. | Passed |
| **TC-03** | Field-Complete Step Action | Highlights input; advances on blur/commit without recording input text. | Passed |
| **TC-04** | SPA Navigation Step | Listens to URL hashchange/popstate; advances when target route matches. | Passed |
| **TC-05** | Manual Step Action | Displays informational instruction card with interactive "Continue" button. | Passed |
| **TC-06** | Ambiguous Target Warning | Detects multiple identical candidates (`candidatesCount > 1`) and warns author. | Passed |
| **TC-07** | Missing Target Recovery | If element unmounts, displays retry prompt and fallback instructions. | Passed |
| **TC-08** | Pause & Resume | Learner can pause tour, browse freely, and resume from the same step. | Passed |
| **TC-09** | Page Refresh / State Persistence | `chrome.storage.local` recovers active run on page reload without losing step. | Passed |
| **TC-10** | Immutable Version Publishing | Published snapshots remain frozen even if author subsequently alters draft. | Passed |
| **TC-11** | Invitation Code Redemption | Learner enters `WJ-XXXXXX` code; verifies origin and launches tour. | Passed |

---

## 2. Accessibility & Keyboard Controls

| Requirement | Implementation | Status |
| :--- | :--- | :--- |
| **Escape Key** | Immediately dismisses element picker or pauses active playback. | Verified |
| **Focus Trapping** | Tooltip action buttons receive clear focus outlines (`:focus-visible`). | Verified |
| **Contrast Ratios** | Minimum 4.5:1 text-to-background contrast across all cards and badges. | Verified |
| **Reduced Motion** | CSS transitions respect `prefers-reduced-motion: reduce`. | Verified |
