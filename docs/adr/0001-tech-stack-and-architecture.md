# ADR 0001: Architecture, Monorepo, and Tech Stack Decisions

## Status
Accepted

## Context
WebJourney requires an authoring interface (Chrome Side Panel), an extension control interface (Popup), an in-page element inspector and playback overlay (Content Scripts with Shadow DOM), a background service worker coordinator (MV3), and shared contracts for journey schemas and step execution.

Additionally, to validate and test journey authoring and playback reliably against clicks, dynamic SPA re-rendering, multi-page transitions, and form interactions, a controlled demo website (`apps/demo-site`) is required.

## Decisions

1. **Monorepo Architecture**:
   - Monorepo using native npm workspaces (`npm` 10.x, Node 22.x).
   - `apps/extension`: Chrome Extension Manifest V3.
   - `apps/demo-site`: Multi-page Vite + React demo application for end-to-end testing and development.
   - `packages/journey-schema`: Shared Zod schemas and TypeScript models for journey definitions.
   - `packages/step-engine`: Pure TypeScript state machine and predicate engine for playback and target resolution.

2. **Extension Framework & Build Tool**:
   - **TypeScript**: Strict type-checking across all packages and apps.
   - **Vite**: Rapid HMR and optimized multi-entry builds for MV3 extension targets (background, content script, popup, side panel).
   - **React 18 / 19**: Component-driven UI for the side panel editor and popup.
   - **Shadow DOM**: Content script overlay is mounted in a dedicated Shadow DOM root with encapsulated styles to prevent host website CSS leakage and vice-versa.

3. **Schema & Safety**:
   - **Zod**: Runtime data validation for journey structures.
   - Strict adherence to privacy: zero extraction of form values, cookies, or sensitive tokens.

4. **Testing**:
   - **Vitest**: Fast unit tests for schema validation, selector generation, and the step state engine.
