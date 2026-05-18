# w1p

Monorepo for `w1p`, with two Svelte applications and one shared package:

- `apps/pwa`: installable PWA with dictionary search, share-target support, persistent log history, and a drawer-based UI
- `apps/extension`: browser extension popup that shows text captured from the context menu
- `packages/shared`: shared i18n, dictionary client, logging utilities, and UI primitives

## Features

- Dictionary lookup through `freedictionaryapi.com`
- Response normalization in the shared client, so the UI works with a stable internal shape
- Browser Cache API support for dictionary responses
- Error handling with structured logging and persistent log storage in `localStorage`
- PWA install flow and `share_target` support
- Extension context menu that sends selected text into the popup via `chrome.storage.local`
- English and Russian UI via `svelte-i18n`

## Workspace Layout

```text
.
├── apps
│   ├── extension
│   └── pwa
├── packages
│   └── shared
├── package.json
└── pnpm-workspace.yaml
```

## Requirements

- Node.js 20+
- `pnpm`

## Install

```bash
pnpm install
```

## Development

Run the PWA:

```bash
pnpm dev:pwa
```

Run the extension app:

```bash
pnpm dev:ext
```

## Build

Build the PWA:

```bash
pnpm build:pwa
```

Build the extension:

```bash
pnpm build:ext
```

## Checks

Type and Svelte checks:

```bash
pnpm check
```

Tests:

```bash
pnpm test
```

Lint:

```bash
pnpm lint
```

Format:

```bash
pnpm format
```

## Release

Use the release script to keep package versions and the changelog in sync:

```bash
pnpm release -- pwa shared patch
```

Preview the target resolution without writing package files or regenerating the
changelog:

```bash
pnpm release -- --dry-run pwa shared patch
```

The last argument is the release type: `patch`, `minor`, `major`, or an exact
`x.y.z` version. When any non-root package is targeted, the root package is
bumped once as the changelog version source. Use `all` only when every package,
including the extension, should receive the same version.

## PWA Notes

- The PWA manifest is configured through `vite-plugin-pwa`
- Shared data is accepted through query params on `/`
- Dictionary log history is stored in `localStorage`
- The log panel supports filtering, search, grouping by day, and JSON export

## Extension Notes

- The extension uses Manifest V3
- `background.js` registers a context menu item for selected text
- Selected text is written into `chrome.storage.local`
- The popup reads that value and displays it through the shared UI components

## Shared Package

`packages/shared` contains:

- dictionary client and normalization layer
- persistent logging utilities
- i18n setup
- shared Svelte components
- Vitest tests for shared logic

## Attribution

This project uses dictionary data from `FreeDictionaryAPI.com`.

- Product UI includes visible attribution to `FreeDictionaryAPI.com`
- Dictionary entries link back to the original Wiktionary page returned by the API
- This README acts as the distribution landing page attribution for the downloadable app
