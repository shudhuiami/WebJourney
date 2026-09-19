# WebJourney — Development Plan

**Implementation architecture, delivery phases, quality gates, and task backlog.**  
*Planning document • Version 1.0 • September 2026*  
*Status: proposed product and implementation decisions; not an existing released application.*

---

## 1. Delivery Assumptions and Non-Goals
- One developer or small team; Chrome desktop is the first supported browser.
- Both author and learner use the extension.
- Test against a controlled demo application (`apps/demo-site`) and real permissioned sites.
- MVP does not replay recorded user actions, read passwords, auto-submit forms, or inject arbitrary code.

---

## 2. Recommended Implementation Stack
- **Extension**: Manifest V3, TypeScript, Vite, React (Popup, Side Panel, Background Service Worker, Content Scripts).
- **UI Primitives**: Scoped CSS + Shadow DOM isolation to prevent host-page CSS contamination.
- **State**: Typed finite-state step engine (`packages/step-engine`) + `chrome.storage.local`.
- **Validation & Contracts**: TypeScript + Zod (`packages/journey-schema`).
- **Tests**: Vitest + Playwright.
- **Backend (Phase 4)**: Node.js (Fastify/Express/NestJS) or Laravel API with PostgreSQL/MySQL.

---

## 3. Monorepo Repository Structure
```
WebJourney/
├── apps/
│   ├── extension/          # Manifest V3 extension (Popup, Side Panel, Worker, Content scripts)
│   ├── demo-site/          # Multi-page test application for authoring & playback validation
│   └── api/                # Backend service for sharing & version persistence (Phase 4)
├── packages/
│   ├── journey-schema/     # Validated shared types, Zod schemas, migrations
│   ├── step-engine/        # Pure step state machine, completion predicates, target resolution
│   └── ui/                 # Shared UI components and icons (optional)
├── docs/                   # Architectural decisions, plans, checklists
│   ├── PRODUCT_PLAN.md
│   ├── DEVELOPMENT_PLAN.md
│   ├── TASKLIST.md
│   └── adr/
├── package.json            # Root workspace config
└── tsconfig.base.json      # Shared TypeScript base configuration
```

---

## 4. Workstreams and Milestone Plan

| Phase | Focus | Exit Gate |
| :--- | :--- | :--- |
| **0. Discovery & Proof** | Permissions, isolated DOM injection, demo app | Prototype works on demo app with safe teardown |
| **1. Foundation** | Monorepo, MV3 shell, message bus, schema | Typed messaging survives SW suspension; schema passes tests |
| **2. Authoring Builder** | Visual element picker, step editor, local drafts | Author creates 5-step journey without touching code |
| **3. Playback Engine** | Step state machine, action observers, overlay | All 4 action types pass verification; pause/resume works |
| **4. Publishing & Sharing** | Version snapshots, invitations, permissions | Immutable versions shared and executed safely |
| **5. Hardening & Release** | Security review, accessibility, packaging | Zero high-sev bugs; Chrome Web Store package ready |
