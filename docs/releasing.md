# Releasing

Product version is **0.3.0** (`package.json`, `apps/desktop`, `apps/web`, `apps/mobile`).

Store listings, code signing, and Apple/Google accounts stay on your machine — they are not in this repository.

## Version

Root, desktop, web, and mobile package versions should match the Git tag (`vX.Y.Z`).

## Web

Vercel project root: this repository. Production deploy is manual (`npx vercel deploy --prod`).

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

Desktop builds update from **GitHub Releases** (`gbordiga/MDWord`). The publish
provider lives in `apps/desktop/electron-builder.yml`, so every desktop build
embeds `resources/app-update.yml` and the release directory gets `latest.yml` /
`latest-linux.yml` plus `.blockmap` files.

- Pushing a `vX.Y.Z` tag runs `.github/workflows/release.yml`. It first fails if
  the tag does not match `package.json`, then builds with
  `pnpm --filter @mdword/desktop dist:publish -- --linux|--win` and uploads the
  installers **and** the update metadata to the GitHub Release using
  `secrets.GITHUB_TOKEN`.
- The **`windows` job publishes the NSIS installer from `windows-latest`**:
  `MDWord-Setup-X.Y.Z.exe`, its `.blockmap` and `latest.yml`.
- The final `verify-release` job runs `node scripts/verify-release.mjs <tag>` and
  fails the release when any of these is missing, or when `latest.yml` /
  `latest-linux.yml` do not point at the tag's version. Run the same script
  locally after a release to check it yourself.
- Installed apps check silently about 8 seconds after launch, download in the
  background and show a banner with **Restart to update**. The update also
  installs on the next normal quit (`autoInstallOnAppQuit`). **File → Updates**
  checks on demand; a failed manual check offers *Try again*.
- Linux: only the **AppImage** can replace itself. A `.deb` install must be
  upgraded with the package manager; the updater reports nothing it cannot do.
- Windows: unsigned NSIS builds can update, but SmartScreen warns on first
  install. Add Authenticode (`CSC_LINK`, `CSC_KEY_PASSWORD`) for a clean prompt.
- macOS: Squirrel.Mac refuses unsigned updates. Build from a Mac with a
  Developer ID certificate and notarization, then
  `pnpm --filter @mdword/desktop dist:publish -- --mac` so `latest-mac.yml` lands
  on the same release.

`pnpm dist` (`--publish never`) stays local: it writes the installer and the
update metadata but never uploads anything.

### Checking a release updates correctly

```sh
node scripts/verify-release.mjs v0.1.11   # CI runs this after every tag
```

It fails when an installer, its `.blockmap` or `latest*.yml` is missing, or when
the metadata points at another version. To test the client side without
installing, electron-updater can be pointed at the real release from a scratch
Electron app with `forceDevUpdateConfig = true` and a `dev-app-update.yml`
(`provider: github`, `owner`, `repo`); a successful run prints the tag, the
installer name and its sha512.

### When the app says "Could not check for updates"

The banner carries a short reason (`HTTP 403`, `DNS lookup failed`,
`network unavailable`, `certificate rejected`, `release metadata missing`, ...).
Details and electron-updater's own log are written to:

- Windows: `%APPDATA%\mdword\logs\updater.log`
- macOS: `~/Library/Application Support/mdword/logs/updater.log`
- Linux: `~/.config/mdword/logs/updater.log`

`Command palette -> Copy diagnostics` includes the tail of that file. A failed
check is retried once after 2.5 s, so a transient network error does not need a
second click. Common causes, in order: a proxy or firewall blocking `github.com`
and `release-assets.githubusercontent.com`, TLS interception on a corporate
network, or being offline.

## Checklist

1. `pnpm test` and `pnpm typecheck` pass
2. Round-trip fixtures pass
3. Manual Definition of Done (`docs/product.md`)
4. Bump the version everywhere (`package.json`, `apps/*/package.json`,
   `packages/shared/src/constants.ts`, `next.config.ts` fallback)
5. Tag `vX.Y.Z` and push the tag — CI publishes the desktop installers and the
   update metadata to the GitHub Release
6. Check the release: `latest.yml`, `latest-linux.yml` and the `.blockmap` files
   must be attached, otherwise installed apps cannot update
7. Deploy web; attach the signed macOS build and (optionally) re-run the Windows
   build with a certificate
8. Submit signed AAB / IPA from your machines
