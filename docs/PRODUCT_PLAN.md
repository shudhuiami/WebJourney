# WebJourney — Product Plan

**Interactive guidance on real websites — teach by doing.**  
*Planning document • Version 1.0 • September 2026*  
*Status: proposed product and implementation decisions; not an existing released application.*

---

## 1. Product Promise
Create a guided journey on a supported website without changing its source code; learners complete real actions with contextual, on-page help.

---

## 2. Executive Summary
WebJourney is a Chrome extension for creating, publishing, and playing step-by-step interactive website walkthroughs. An author uses a visual builder to select a page element, write guidance, and define what counts as completing each step. A learner runs the journey in the actual web application; a contextual overlay highlights the target and advances only when the defined action occurs.

The initial product is extension-to-extension: authors and learners install the WebJourney extension. The extension operates without installing an SDK on the target website. A future optional website SDK can support visitors who do not have the extension, but this is a separate integration model and is explicitly out of MVP scope.

---

## 3. Problem, Audience, and Jobs to be Done

| Audience | Problem | Job to be Done |
| :--- | :--- | :--- |
| **Agency / implementation team** | Repeatedly teaching clients how to use delivered software | Record one approved product workflow, share it with the client, revise when UI changes. |
| **Business trainer / administrator** | New employees struggle through complex admin panels | Assign role-specific onboarding and see completion without capturing sensitive form inputs. |
| **Software product team** | Static guides become stale and users abandon flows | Publish contextual in-app learning and repair broken steps quickly. |
| **Learner** | Tutorial videos are separate from the task | Follow instructions on the live website and confirm each action in context. |

---

## 4. Core Product Principles
1. **Teach on the live site, not in a separate slide deck**: each step corresponds to an observable action or explicitly acknowledged instruction.
2. **Preserve target-site behavior**: the extension guides and observes; it must not silently submit forms, purchase products, or change settings on a learner’s behalf.
3. **Give learners control**: start/pause/skip/exit; require clear consent for a published journey to run on a site.
4. **Fail visibly**: if an element cannot be found, offer retry, skip (when allowed), or report broken step; never fabricate progress.
5. **Keep the authoring model understandable** to non-developers without hiding advanced selector diagnostics.
6. **Minimize permissions and data capture**: never record field values, cookies, tokens, or arbitrary page content by default.

---

## 5. Scope: MVP, Later, Not Included

| MVP (First Usable Product) | Later Phases | Explicitly Not in MVP |
| :--- | :--- | :--- |
| Chrome Manifest V3 extension; author and learner modes | Team workspaces, assignment & completion dashboard | No-install tours for arbitrary third-party websites |
| Click, type-completed, navigation, and manual-continue steps | Conditional branches, rich media, localization | Universal support for browser internal pages, restricted sites or cross-origin iframes |
| Visual element selection and step editor | Visual analytics and version comparisons | Unrestricted user scripting / arbitrary JavaScript evaluation |
| Publish via short-lived share code/link to other extension users | Optional embeddable SDK for sites you control | Promise of 100% selector reliability across all websites |
| Pause/resume, broken-step handling, local progress | Org SSO, LMS export, AI-assisted draft instructions | Auto-typing passwords, financial actions, or silent form submission |

---

## 6. Primary User Workflows

### 6.1 Author creates a journey
1. Choose a supported HTTPS website and grant host access for its origin.
2. Start recording mode; select an element with a visible picker.
3. Choose action type: click, focus/type completion without storing field contents, URL navigation, or manual acknowledgement.
4. Write instruction, optional context, and safe fallback when target is missing.
5. Preview each step on the real site, validate progression, then save as draft.
6. Run a dry-run from a fresh session; publish a version and generate invitation link/code.

### 6.2 Learner follows a journey
1. Open invite in Chrome, install/enable extension if needed, and approve site-specific permission.
2. Preview title, site hostname, step count, author, and what extension can observe.
3. Click Start; overlay highlights target and positions instruction card.
4. Perform action on the site; WebJourney confirms completion condition and advances.
5. Pause, resume, or report broken step; finish with completion acknowledgement.

### 6.3 Author repairs a broken journey
1. Review failed step with original URL and saved target fingerprint.
2. Re-open target page, relink element, and retest step and adjacent steps.
3. Publish new immutable version; keep existing learner runs pinned or deliberately migrate them.

---

## 7. Product Modules

| Module | MVP Capability | Acceptance Signal |
| :--- | :--- | :--- |
| **Onboarding & permissions** | Origin-specific opt-in, concise explanation, pause/off switch | The extension never runs on an unapproved origin. |
| **Journey library** | Create, duplicate, edit, archive, list, search drafts | Author can reopen a draft and continue editing. |
| **Visual builder** | Element picker, action selector, tooltip content, ordering | A nontechnical user creates a five-step flow without selector editing. |
| **Player overlay** | Spotlight, tooltip, next/previous, pause, exit, keyboard focus | Learner can complete the same journey without layout obstruction. |
| **Step engine** | Click, focus/type complete, URL navigation, manual continue | Step does not advance until its declared condition is met. |
| **Sharing & versions** | Private link/code, publish/unpublish, version snapshot | Invite resolves to the intended immutable published version. |
| **Diagnostics** | Missing target, URL mismatch, timeout, retry/skip/report | A broken step does not trap the learner. |
| **Local progress** | Persist current journey/version/step with expiry | A refresh can resume when the website state remains compatible. |

---

## 8. Step Types and Completion Rules

- **Click**: Target element and optional expected URL/DOM change. Learner completion: trusted click on intended element; optionally wait for resulting state.
- **Field completion**: Target input; presence/focus or non-empty state rule. Observe completion state, never collect or upload typed contents.
- **Navigation**: Expected origin and URL/path matcher. Matching page loads and target becomes available.
- **Manual continue**: Instruction without interactive target. Learner explicitly selects Continue.

---

## 9. Information Architecture & Surfaces
- **Extension popup**: Current site access status, start a journey, open builder/library, pause extension.
- **Chrome side panel**: Journey library, visual builder, draft editing, step reorder, preview, publish, version history.
- **On-page overlay**: Learner player (Shadow DOM isolated), step progress, spotlight, instruction card, navigation, reporting.
