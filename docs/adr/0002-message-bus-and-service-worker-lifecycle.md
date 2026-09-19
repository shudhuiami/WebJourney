# ADR 0002: Manifest V3 Service Worker Lifecycle & Resilient Message Passing

## Status
Accepted

## Context
Manifest V3 deprecates persistent background pages in favor of ephemeral Service Workers. Chrome may terminate the service worker after ~30 seconds of inactivity. If the extension relies on in-memory state in the service worker, state will be lost on suspension.

Additionally, communication occurs across three distinct execution contexts:
1. **Side Panel / Popup (UI context)**: React application displaying authoring controls, journey steps, and diagnostics.
2. **Background Service Worker**: Routes messages between tabs and handles browser lifecycle events.
3. **Content Script (Target page context)**: Interacts with the host DOM, manages Shadow DOM overlays, and observes user actions.

## Decisions

1. **State Persistence**:
   - Durable state (draft journeys, active player run status, approved origins) MUST be persisted in `chrome.storage.local`.
   - The service worker operates as a stateless coordinator and message router.

2. **Typed Message Protocol**:
   - All runtime messages conform to a strict discriminated union (`type: string`, `payload: any`).
   - Every message sent between the Side Panel and Content Script includes an explicit response acknowledgment or timeout handler.

3. **Origin & Tab Scoping**:
   - Content scripts only attach active event listeners when explicitly activated by an authoring or playback command.
   - On teardown, all listeners and Shadow DOM host nodes are removed to leave the target website in an untampered state.
