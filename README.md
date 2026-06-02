<p align="center">
  <img src="screenshots/screenshot-2026-06-02.png" alt="tyst" width="80%" />
</p>

**tyst** is a minimal document editor that saves to [Typst](https://typst.app) source files and exports to PDF.

It gives you a clean, distraction-free writing surface with a floating toolbar for formatting — text styles, headings, lists, tables, images, footnotes, and more. Document settings like page size, margins, fonts, and language live in a top bar out of the way.

## Requirements

- [Node.js](https://nodejs.org) and [Bun](https://bun.sh)
- [Rust](https://www.rust-lang.org/tools/install) (for building the Tauri backend)
- [Typst CLI](https://github.com/typst/typst) (for PDF export — `brew install typst`)

## Development

```bash
bun install
bun run tauri dev
```

## Build

```bash
bun run tauri build
```
