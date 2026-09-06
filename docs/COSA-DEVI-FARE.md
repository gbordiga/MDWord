# Cosa devi fare tu per pubblicare MDWord

Questo file elenca **solo** i passi che non posso completare da qui (account, firme, Mac/Windows, schede store). Il codice è su `main`, versione **0.1.0**.

Sito già online: https://mdword-tawny.vercel.app

Identificativi:

| App | ID |
| --- | --- |
| Web | progetto Vercel `mdword` |
| Desktop | `app.mdword.desktop` |
| Android / iOS | `app.mdword.mobile` |

Se vuoi un bundle id diverso (`it.tuodominio.mdword`), **cambialo in `apps/mobile/capacitor.config.ts` prima del primo upload** sugli store: dopo il primo invio non si cambia più.

---

## 1. Web (già fatto, da ripetere a ogni release)

Da questa root, dopo il merge su `main`:

```bash
npx vercel deploy --prod --yes
```

Vercel **non** pubblica in automatico da Origin. Serve una **privacy policy** e una pagina di supporto (URL https) prima di Play / App Store: puoi metterle sul sito o su una pagina Notion/GitHub.

---

## 2. Desktop Linux (binari locali)

Sulla macchina di sviluppo, dopo `git pull`:

```bash
pnpm install
pnpm dist -- --linux
```

Output in `apps/desktop/release/`:

- `MDWord-0.1.0.AppImage`
- `MDWord-0.1.0.deb`

Poi:

1. Crea il tag se manca: `git tag v0.1.0 && git push origin v0.1.0`
2. Apri un **GitHub Release** (o Origin Release) `v0.1.0`
3. Allega AppImage e deb
4. (Opzionale) firma GPG i file

Non c’è auto-update (`publish: null` in electron-builder). Chi scarica aggiorna a mano.

---

## 3. Desktop Windows (serve un PC Windows)

```bash
pnpm install
pnpm dist
```

Ottieni `MDWord-Setup-0.1.0.exe` (NSIS).

Senza certificato Authenticode Windows mostra SmartScreen. Per firmarlo: certificato code-signing e variabili `CSC_LINK` + `CSC_KEY_PASSWORD` prima di `pnpm dist`. Allega l’exe allo stesso Release `v0.1.0`.

---

## 4. Desktop macOS (serve un Mac)

```bash
pnpm install
pnpm dist
```

Ottieni `MDWord-0.1.0.dmg`.

Per usarlo fuori dall’App Store:

1. Apple Developer (99 USD/anno)
2. Certificato **Developer ID Application**
3. Notarization: `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`

Senza notarization Gatekeeper blocca l’app. Allega il dmg al Release.

---

## 5. Google Play

Una tantum: [Play Console](https://play.google.com/console) (~25 USD).

Sul tuo computer (Linux o Mac va bene):

```bash
pnpm install
pnpm mobile:sync
pnpm mobile:android
```

In Android Studio:

1. Crea un **keystore** (guardalo: se lo perdi non aggiorni più l’app)
2. Build → Generate Signed App Bundle → `.aab`
3. Play Console → Crea app “MDWord” → Produzione / test interno
4. Compila scheda: testo, screenshot telefono (e tablet se vuoi), classificazione contenuti, privacy policy URL, email contatto
5. Carica l’AAB

Categorie: Productivity / Office. Non indicare che l’app è “solo un sito”: è un editor offline con salvataggio nativo.

---

## 6. Apple App Store (solo Mac)

Una tantum: Apple Developer.

```bash
pnpm install
pnpm mobile:sync
cd apps/mobile/ios/App && pod install
pnpm mobile:ios
```

In Xcode:

1. Signing & Capabilities → il tuo Team
2. Product → Archive
3. Distribute App → App Store Connect
4. In App Store Connect: screenshot iPhone (e iPad), descrizione, privacy, note per la review

Nelle note di review: *“MDWord is a local Markdown editor. Documents are stored on device and shared via the system share sheet. It does not load the marketing website as the UI.”*

---

## 7. Materiali store (da preparare tu)

Icona 1024: `apps/mobile/assets/icon/icon-1024.png` (già nel repo).

Ti servono ancora:

- Screenshot reali da telefono/tablet (web o emulatore)
- Testo store (nome, sottotitolo, descrizione IT/EN)
- Privacy policy e termini (anche una pagina statica)
- Account sviluppatore Play + Apple
- Keystore Android e certificati Apple

Splash e icone launcher usano già il logo MDWord (documento bianco su blu `#1D4ED8`).

---

## Comandi rapidi

```bash
# sito
npx vercel deploy --prod --yes

# linux desktop
pnpm dist -- --linux

# sync nativo (prima di aprire Android Studio / Xcode)
pnpm mobile:sync
pnpm mobile:android
pnpm mobile:ios
```

Dettagli tecnici anche in `docs/releasing.md` e `apps/mobile/README.md`.
