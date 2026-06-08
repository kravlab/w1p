# w1p Extension

Svelte browser extension popup for `w1p`, used to view selected text captured from a context-menu action.

## Features

- Manifest V3 extension
- background service worker that adds a `Send to w1p` context-menu item
- popup UI that reads the latest captured text from `chrome.storage.local`
- shared translations and UI components from `@workspace/shared`

## Development

From the repo root:

```bash
pnpm dev:ext
```

## Build

From the repo root:

```bash
pnpm build:ext
```

## Checks

From the repo root:

```bash
pnpm -F extension check
```

## Notes

- extension manifest lives in `public/manifest.json`
- background logic lives in `public/background.js`
- popup entry point is `src/App.svelte`
