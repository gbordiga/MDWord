# Releasing

## Version

Root and `apps/desktop` share the product version displayed in the about dialog.

## Web

Vercel project root: this repository. Build:

```
pnpm install
pnpm build:web
```

Output: `apps/web/out` (static export).

## Desktop binaries

```sh
pnpm dist
```

electron-builder targets:

- Windows: NSIS `.exe`
- macOS: `.dmg` (build on macOS; code signing documented below)
- Linux: `.AppImage`, `.deb`

CI on Linux produces Linux packages. Windows/macOS artifacts should be built on matching runners for production signatures.

## Code signing

Not required for MVP. For production:

- **Windows:** Authenticode (`CSC_LINK`, `CSC_KEY_PASSWORD`)
- **macOS:** Developer ID + notarization (`APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`)
- **Linux:** optional GPG for the AppImage/deb

## Auto-update

`electron-updater` is wired but **disabled for MVP** (`publish: null`). Enable later with GitHub Releases.

## Checklist

1. `pnpm test` and `pnpm typecheck` pass
2. Round-trip fixtures pass
3. Manual Definition of Done (product.md / master prompt §85)
4. Tag `vX.Y.Z`
5. Attach installers to the GitHub Release
