# Releasing

Product version is **0.1.0** (`package.json`, `apps/desktop`, `apps/web`, `apps/mobile`).

What only you can do (stores, signing, Windows/Mac machines) is listed in Italian in [`COSA-DEVI-FARE.md`](./COSA-DEVI-FARE.md).

## Version

Root, desktop, web, and mobile package versions should match the Git tag (`vX.Y.Z`).

## Web

Vercel project root: this repository. Origin git does **not** auto-deploy.

```
npx vercel deploy --prod --yes
```

Static output: `apps/web/out`.

## Desktop binaries

```sh
pnpm dist
```

electron-builder targets:

- Windows: NSIS `.exe` (build on Windows for a production installer)
- macOS: `.dmg` (build on macOS; notarize for distribution)
- Linux: `.AppImage`, `.deb` (`pnpm dist -- --linux` from Linux)

CI on `main` may produce Linux packages. Attach installers to a GitHub/Origin Release for the tag.

## Mobile (Play / App Store)

```sh
pnpm mobile:sync
pnpm mobile:android   # Android Studio → signed AAB
pnpm mobile:ios       # Xcode on macOS → Archive
```

App ID: `app.mdword.mobile`. See `apps/mobile/README.md`.

## Code signing

Not required to build. For production distribution:

- **Windows:** Authenticode (`CSC_LINK`, `CSC_KEY_PASSWORD`)
- **macOS:** Developer ID + notarization (`APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`)
- **Linux:** optional GPG for the AppImage/deb
- **Android:** Play upload keystore
- **iOS:** Apple Distribution certificate via Xcode

## Auto-update

`electron-updater` is wired but **disabled** (`publish: null`). Enable later with GitHub Releases.

## Checklist

1. `pnpm test` and `pnpm typecheck` pass
2. Round-trip fixtures pass
3. Manual Definition of Done (`docs/product.md`)
4. Tag `vX.Y.Z` and push the tag
5. Deploy web; attach desktop installers to the Release
6. Submit signed AAB / IPA from your machines
