# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**tyst** is a Typst document editor built with SvelteKit + Tauri. The editor lets users compose documents visually and exports them as `.typ` source files or compiled PDFs via the Typst CLI. The app runs as a native desktop app (Tauri v2) but also works in a browser for development.

## Commands

```bash
# Frontend dev server (browser only, no Tauri)
bun run dev

# Full desktop app (Tauri + frontend)
bunx tauri dev

# Type-check (Svelte + TypeScript)
bun run check

# Build frontend for production
bun run build

# Build desktop app
bunx tauri build
```

There are no tests. Type-checking with `bun run check` (runs `svelte-check`) is the primary correctness tool.

## Architecture

### Document model (`src/lib/document/`)

The core abstraction. Everything serializes to/from `DocumentModel` defined in `types.ts`.

- **`types.ts`** — all data types: `DocumentModel`, `Block`, `TypographySettings`, `ParagraphSettings`, `PageSettings`. The model is close to a 1:1 mapping to Typst constructs.
- **`store.svelte.ts`** — singleton `documentStore` (Svelte 5 runes class). Single source of truth for editor state. Exposes derived `typ` (the serialized `.typ` string), selection state, and all mutation methods.
- **`serialize.ts`** — converts `DocumentModel` → `.typ` source. Key rules: continuation blocks serialize inline using `#text(...)[content]` (not the block-scoped `#[...]` form which is block-level in Typst); non-continuation blocks use `#[#set text(...) content]`.
- **`units.ts`** — unit conversions (pt ↔ px ↔ cm). The page is laid out at its true physical size in CSS px then scaled down with a CSS transform to fit the viewport.

### Block model

A document is a flat array of `Block` objects. Each block is one visual line. The `continuation: true` flag marks blocks that are inline with their predecessor (used for inline-range formatting, e.g. bold a word mid-sentence). Three blocks represent `"test hi " | "hello"(cont) | " wow"(cont)` — all on one line in both the editor and the PDF.

**Inline-range formatting flow:**
1. User selects text within a single block → `intraBlockSelection` is set.
2. User unlinks typography → `splitBlockAtSelection` splits the block into before/mid/after, mid gets `continuation: true`.
3. Serializer concatenates continuation blocks directly (no `\n`) and uses `#text(weight: "bold")[mid]` syntax.

### Editor components (`src/lib/components/editor/`)

- **`Editor.svelte`** — root layout; bridges native menu events (Save, Export) to frontend.
- **`Document.svelte`** — renders all blocks onto paginated sheets; handles layout (page-break detection via measured block heights), cross-block selection detection, caret management, and block split/merge.
- **`Block.svelte`** — single contenteditable block. Continuation blocks and blocks immediately followed by a continuation render `display: inline` (prop `renderInline`). Handles arrow-key navigation across block boundaries within inline groups.
- **`Toolbar.svelte`** + **`TypographyPopup.svelte`** — formatting controls that read/write `documentStore`.

### Tauri backend (`src-tauri/src/lib.rs`)

Three Rust commands exposed to the frontend:
- `list_system_fonts` — enumerates installed font families via `fontdb`.
- `write_text_file` — saves `.typ` source to disk.
- `export_pdf` — writes source to a temp file, runs the `typst compile` CLI, cleans up.

The Typst CLI must be installed separately (`brew install typst`). The frontend degrades gracefully when running without Tauri (browser dev mode).

### Tauri ↔ frontend bridge

`src/lib/system/tauri.ts` wraps all `invoke()` calls and exports an `isTauri()` guard. `src/lib/system/files.ts` implements Save/Export using native dialogs. `src/lib/system/fonts.svelte.ts` is a reactive store that lazy-loads system fonts.

## Key invariants

- All sizes in the model are stored in **typographic points** (pt). CSS rendering converts via `ptToPx()`. Serialization emits `pt` or `em` directly.
- `leading` (line spacing in em) lives on `TypographySettings`, not `ParagraphSettings`, because Typst's `par(leading)` needs to stay coupled to the font.
- The page is rendered at `RENDER_SCALE = 2×` and CSS-scaled down, so the caret renders crisply on HiDPI screens.
- Continuation blocks report height `0` to the layout engine; only the leading (non-continuation) block of an inline group contributes to page-break calculations.
