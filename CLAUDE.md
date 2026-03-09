# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Global Speed is a cross-browser extension (Chrome 116+, Firefox 125+) for universal playback speed control, audio effects (pitch, EQ, volume boost), visual filters, customizable hotkeys, and URL-based rules. Built with TypeScript, React 19, Webpack 5.

## Build Commands

```bash
npm run build:dev         # Dev build (Chromium) → build/unpacked/
npm run build:devFf       # Dev build (Firefox) → buildFf/unpacked/
npm run build:prod        # Prod build + zip (Chromium)
npm run build:prodFf      # Prod build + zip (Firefox)
npm run build:prodEdge    # Prod build for Edge (strips subtitle from name)
npm run adhere            # Regenerate locale messages + GsmType.ts (run after changing locales)
npm run format            # Prettier check
npm run format:fix        # Prettier fix
```

No test suite exists. No linter configured. TypeScript strict mode (`noImplicitAny: true`) is the primary static check.

## Architecture

### Entry Points (Webpack bundles)

| Bundle | Entry | Context |
|---|---|---|
| `background` | `src/background/index.ts` | Service worker — state management, keybind processing, tab lifecycle, context menus |
| `popup` | `src/popup/popup.tsx` | Extension popup — speed controls, FX panels |
| `options` | `src/options/options.tsx` | Options page — keybinds, rules, settings |
| `isolated` | `src/contentScript/isolated/index.ts` | Content script (ISOLATED world) — Overseer, MediaTower, SpeedSync, FxSync |
| `main` | `src/contentScript/main/index.ts` | Content script (MAIN world) — prototype overrides, GhostMode |
| `pageDraw` | `src/contentScript/pageDraw/index.ts` | Page drawing utilities |
| `pane` | `src/contentScript/pane/index.ts` | Interactive control pane |
| `offscreen` | `src/offscreen/index.ts` | Chromium only — AudioWorklet host for pitch/reverse processing |
| `mainLoader` | `src/contentScript/main/loader.ts` | Firefox only — delayed content script loader |

### Browser-Conditional Code

Webpack aliases control platform-specific imports:
- `notFirefox/*` → resolves to `src/*` on Chromium, `false` on Firefox
- `isFirefox/*` → resolves to `src/*` on Firefox, `false` on Chromium

The `FIREFOX` env var toggles the build target. Chromium builds include offscreen AudioWorklet processors (`SoundTouchProcessor`, `ReverseProcessor`). Firefox uses native `playbackRate` only.

### Global Variable: `gvar`

`gvar` is auto-provided to all files via Webpack's `ProvidePlugin` (no import needed). Defined in `src/globalVar.ts`. Each context populates it differently — e.g., background sets `gvar.es` (storage wrapper), content scripts set overseer references.

### State Management

Three-tiered chrome.storage key scheme with prefix namespacing:
- **Global** (`g:key`): Extension-wide settings (speed presets, keybinds, rules, language)
- **Tab-pinned** (`t:<tabId>:key`): Per-tab overrides when tab is "pinned"
- **Rule overrides** (`r:<tabId>:key`): URL-rule-applied overrides

Core types in `src/types.ts`:
- `State`: Global config (version, keybinds, rules, ghostMode, indicator settings)
- `Context`: Per-tab state (speed, enabled, audioFx, elementFx, backdropFx)
- `StateView`: Merged view combining global + tab + rule layers

State utilities in `src/utils/state.ts`: `fetchView()`, `pushView()`, `SubscribeView` (reactive subscriptions with watchers).

### Content Script Architecture

The isolated world content script uses an orchestrator pattern:
- **Overseer** (`src/contentScript/isolated/Overseer.ts`): Root lifecycle manager
- **MediaTower**: Discovers and tracks `HTMLMediaElement` instances including inside ShadowRoots
- **SpeedSync**: Applies speed changes to discovered media
- **ConfigSync**: Subscribes to storage changes and syncs config
- **FxSync**: Applies CSS filters/transforms
- **StratumServer/StratumClient**: Two-way Port communication between isolated and main worlds

The main world script overrides native prototypes (`play`, `pause`, `load`, `attachShadow`) and implements GhostMode (descriptor hijacking for `playbackRate`).

### Key Patterns

- **`@/` import alias** maps to `src/` (configured in both tsconfig and webpack)
- **CSS**: PostCSS with nesting plugin + autoprefixer. Raw CSS imports use `?raw` query
- **i18n**: Locale JSON files in `static/locales/`. `GsmType.ts` is auto-generated — run `npm run adhere` after locale changes
- **Messaging**: Typed message system via global `Message` interface augmentation in `src/types.ts`
- **Commands**: All keybind actions defined in `src/defaults/commands.ts` with `CommandName` union type
- **State defaults**: `src/defaults/index.ts` (schema version 14 with migration support in `src/background/utils/migrateSchema.ts`)
