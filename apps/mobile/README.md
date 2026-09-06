# MDWord on the App Store and Google Play

Same editor as the website (`apps/web` static export), wrapped with [Capacitor](https://capacitorjs.com/). This is the store path: not a React Native rewrite, and not a PWA.

## What you get

- Offline app (the web build is bundled into the native project)
- Native share sheet to save `.md` into Files / Drive
- Status bar, keyboard resize, splash
- Document type for Markdown files

Store listing, signing, and Apple/Google accounts still happen on your machine.

## One-time machine setup

- **Android:** Android Studio, JDK 21, a Play Console account
- **iOS:** macOS, Xcode, an Apple Developer account (`cap add ios` / archive must run on a Mac)

## Build and open

From the repo root:

```bash
pnpm install
pnpm mobile:sync
pnpm mobile:android   # Android Studio
pnpm mobile:ios       # Xcode (macOS only)
```

`mobile:sync` builds the web app, copies it into `android/` and `ios/`, and applies store metadata (icons, document types).

## Store identifiers

| | |
| --- | --- |
| App ID | `app.mdword.mobile` |
| Display name | MDWord |
| Category | Productivity / Office |

Change the App ID in `capacitor.config.ts` before the first store upload if you want a different bundle id. After changing it, run `pnpm mobile:sync` again.

## Release checklist

1. Bump `apps/web/package.json` / `apps/mobile/package.json` version
2. `pnpm mobile:sync`
3. Android Studio → Generate Signed App Bundle (Play)
4. Xcode → Product → Archive → App Store Connect
5. Fill store listings (screenshots, privacy policy URL, support URL)

Apple rejects “website in a wrapper” if there is no native behaviour. Share-to-Files, bundled offline editor, and Markdown document types are that behaviour. Do not submit a WebView that only loads `mdword-tawny.vercel.app`.
