# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start dev server (port 3000)
npm run build        # Production build
npm run serve        # Preview production build (port 3000)
npm run lint         # ESLint check
npm run lint:fix     # Auto-fix ESLint issues
npm run lint:style   # Fix CSS/Vue style issues (Stylelint)
npm run lint:dpdm    # Check for circular dependencies in TypeScript
```

No test suite exists in this project.

Package manager: **Yarn** (use `yarn` not `npm` for dependency management).

Node.js >=20 required.

## Architecture

**Word GPT Plus** is a Microsoft Word add-in (Office.js) that provides AI/LLM chat and agent capabilities inside Word
documents.

### Entry Flow

`index.html` loads Office.js from Microsoft CDN → `src/main.ts` waits for `Office.onReady()` → creates Vue app with
router + i18n → mounts to `#app`.

The app never runs as a standalone webpage — it requires the Word/Office runtime environment.

### Routing

Vue Router with **memory-based history** (required for Office add-in context — no URL bar). Two main routes:

- `/` → `HomePage.vue` (kept alive)
- `/settings` → `SettingsPage.vue`

### AI Provider Layer (`src/api/`)

- `types.ts` — TypeScript interfaces for all provider configs (OpenAI, Azure, Gemini, Groq, Ollama)
- `union.ts` — Unified chat/agent execution using LangChain; handles both streaming chat and multi-step agent runs
- `common.ts` — Word document insertion utilities (called after AI responses)
- `checkpoints.ts` — `IndexedDBSaver` implementation using Dexie for LangGraph checkpoint persistence

### Two Execution Modes

1. **Chat mode** — Simple streaming Q&A via LangChain chat models
2. **Agent mode** — LangGraph ReAct agent with 25+ Word manipulation tools, recursion limits, and checkpoint tracking

### Word Tools (`src/utils/wordTools.ts`)

LangChain tool definitions for Office.js operations: read selection, insert/replace text, format, search/replace, insert
tables/lists/images/bookmarks, navigate by bookmark, etc.

### State & Persistence

- **localStorage** — API keys, model settings, custom prompts (keys enumerated in `src/utils/enum.ts`)
- **IndexedDB** (Dexie) — Conversation checkpoints/agent history (`src/api/checkpoints.ts`)
- No backend; all API calls go directly from the browser to AI providers

### Supported AI Providers

OpenAI, Azure OpenAI, Google Gemini, Groq, Ollama (local). Provider selection and model lists are in
`src/utils/constant.ts`.

### i18n

Two locales: `en` and `zh-hk`. Translation files in `src/i18n/locales/`. Add new keys to both files when adding UI text.

### Key Quirks

- `async_hook.js` — mocks `AsyncLocalStorage` at the Vite entry point to make LangChain work in the browser (no Node.js
  runtime)
- ResizeObserver is patched with 16ms debouncing in `main.ts` to prevent Word add-in layout thrashing
- Path alias `@/` maps to `src/`

## Deployment

The built output (`dist/`) is served as a static site. Two manifest variants in `release/`:

- `instant-use/` — points to the hosted version
- `self-hosted/` — customize the URL in `manifest.xml` to point to your server

Docker image: `kuingsmile/word-gpt-plus` (multi-stage: Node 22 build → Nginx serve).
