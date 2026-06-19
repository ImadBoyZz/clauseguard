# ClauseGuard

A Microsoft Word add-in that **spell-checks Dutch and English documents — fully offline** — and applies fixes as native Word **track changes** with explanatory **comments**.

Built as a focused, privacy-first proofreading helper for contracts and other professional documents: it runs entirely on your machine, with no backend, no API keys, and no network calls.

---

## What it does

- **Scans every paragraph** for misspellings using an offline dictionary engine ([`nspell`](https://github.com/wooorm/nspell) + Dutch & English Hunspell dictionaries).
- For each finding it shows the **flagged word**, a **suggested correction**, and a short, plain-language **"why"**.
- **Apply a fix** and it lands as a native **tracked change** plus a **Word comment** — so you can review, accept, or reject it like any other edit. Bulk *Apply all*, and (on Word with WordApi 1.6) document-wide *Accept all* / *Reject all*.
- **Nothing leaves your document.** All processing is local and offline.

## Language modes

A **Taal** (language) selector controls which dictionary the check uses:

| Mode | Behaviour |
|------|-----------|
| **Auto** | Per-paragraph language detection, **lenient** — a word is only flagged when *neither* the Dutch nor the English dictionary knows it (so English terms inside a Dutch contract stay valid). |
| **NL** / **EN** | Force one language for the whole document, **strict** — only that dictionary counts, and other-language words are deliberately flagged. |

The choice is remembered (`localStorage`) and takes effect on the next scan.

## How it works

The engine lives in `src/taskpane/core/`:

- `wordDocument.ts` — reads all paragraphs (keeps Word's exact paragraph order/indices).
- `spellEngine.ts` — runs `nspell` (NL + EN) per the chosen language mode, with per-paragraph language detection in *Auto*.
- `runChecks.ts` — orchestrates the scan, computes per-paragraph occurrence indices, and assigns stable issue ids.
- `trackChanges.ts` — applies each accepted suggestion as a tracked change (`insertText` Replace) and attaches a Word comment with the "why".

`hooks/useClauseGuard.ts` drives the UI state; the task pane is **React 18 + Fluent UI v9**. WordApi **1.4** is the minimum (track changes + comments); **1.6** unlocks the document-wide Accept/Reject buttons.

## Tech stack

React 18 · TypeScript 5 · Fluent UI v9 · Office.js · Webpack 5 (ES5 target) · `nspell` + `dictionary-nl` + `dictionary-en` · XML manifest. Target host: **Word desktop on Windows**.

## Getting started

Prerequisites: **Node.js 18+** and **Microsoft Word** (desktop).

```bash
npm install
npm start        # sideloads the add-in in Word and starts the dev server (https://localhost:3000)
```

On first run, accept the HTTPS dev-certificate prompt. The first scan loads the dictionaries (~6 MB). Open the pane with the **Show Task Pane** button on the Home ribbon, then click **Scan document**.

Try it with `demo/demo-fouten.docx`, which contains intentional spelling mistakes.

### Scripts

| Command | What it does |
|---------|--------------|
| `npm start` | Sideload in Word + dev server on :3000 |
| `npm run build` | Production build → `dist/` |
| `npm run build:dev` / `npm run watch` | Development build (one-off / watch) |
| `npm run dev-server` | Webpack dev server only (https://localhost:3000) |
| `npm run lint` / `npm run lint:fix` | Lint (ESLint + Prettier) |
| `npm run validate` | Validate `manifest.xml` |
| `npm run stop` | Stop the sideload |

## Privacy

Everything is processed **locally and offline**. There is no server component, no telemetry, and no document data ever leaves your machine.

## License

MIT.
