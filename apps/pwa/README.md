# w1p

Installable Svelte PWA for the `w1p` dictionary experience and shared-content display.

## Features

- word lookup through the shared dictionary client
- install prompt support
- Web Share Target support through query params on `/`
- drawer-based layout
- persistent log history with filtering, search, grouping, and JSON export

## Development

From the repo root:

```bash
pnpm dev:pwa
```

## Build

From the repo root:

```bash
pnpm build:pwa
```

## Checks

From the repo root:

```bash
pnpm -F pwa check
```

## Notes

- PWA manifest is configured in `vite.config.ts`
- dictionary search and logging are powered by `@workspace/shared`
- shared data is rendered from `title`, `text`, and `url` query params
