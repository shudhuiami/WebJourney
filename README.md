# WebJourney 🌐

> **Interactive guidance on real websites — teach by doing.**

WebJourney is a Chrome Manifest V3 extension for creating, publishing, and playing step-by-step interactive website walkthroughs directly on live websites without requiring source code changes.

---

## 🏗️ Architecture & Monorepo Structure

```
WebJourney/
├── apps/
│   ├── extension/          # Manifest V3 Chrome Extension (React, Vite, Shadow DOM overlay)
│   ├── demo-site/          # Multi-page test application for authoring & playback testing
│   └── api/                # Backend service for sharing & version persistence (Phase 4)
├── packages/
│   ├── journey-schema/     # Validated Zod schemas and TypeScript models
│   ├── step-engine/        # Pure step state machine, completion predicates, target resolution
│   └── ui/                 # Shared UI primitives (optional)
├── docs/                   # Product plan, development plan, tasklist, and ADRs
│   ├── PRODUCT_PLAN.md
│   ├── DEVELOPMENT_PLAN.md
│   ├── TASKLIST.md
│   └── adr/
├── package.json            # Root workspace config
└── tsconfig.base.json      # Shared TypeScript base configuration
```

---

## 🚀 Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Run the Demo Test Application
```bash
npm run dev:demo
```
The demo application will be available at `http://localhost:5173`.

### 3. Build & Load the Extension
```bash
npm run build:ext
```
To load into Google Chrome:
1. Open `chrome://extensions/`
2. Toggle on **Developer mode** (top right)
3. Click **Load unpacked**
4. Select `apps/extension/dist`

### 4. Run Tests
```bash
npx vitest run
```

---

## 📋 Development Backlog & Milestones
See [TASKLIST.md](docs/TASKLIST.md) for detailed tasks from Phase 0 through Phase 5.
