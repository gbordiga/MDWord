import type { ReactNode } from "react";
import type { Metadata, Viewport } from "next";
import "katex/dist/katex.min.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "MDWord",
  description: "Structured document editor with MyST Markdown as the source of truth.",
  applicationName: "MDWord",
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" }
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }]
  },
  appleWebApp: {
    capable: true,
    title: "MDWord",
    statusBarStyle: "default"
  },
  formatDetection: {
    telephone: false
  }
};

/**
 * Content Security Policy for the static app. Inline scripts are required by the
 * Next.js bootstrap, so this blocks the channels that matter for a Markdown
 * editor: remote script origins, network exfiltration (`connect-src`), plugin
 * objects, form posts and base-tag hijacking. Development is exempt because the
 * dev server needs eval and a websocket.
 */
const CSP = [
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline' blob:",
  "img-src 'self' data: blob: https: http: mdword:",
  "font-src 'self' data: blob: https: http:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'"
].join("; ");

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#1a1612",
  interactiveWidget: "resizes-content"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="it">
      <head>{process.env.NODE_ENV === "production" ? <meta httpEquiv="Content-Security-Policy" content={CSP} /> : null}</head>
      <body>
        <div id="mdword-boot" className="md-boot" data-testid="app-boot" role="status" aria-live="polite">
          <div className="md-boot-card">
            <span className="md-spinner" style={{ width: 28, height: 28 }} />
            <p className="md-boot-copy">Loading editor…</p>
          </div>
        </div>
        {children}
      </body>
    </html>
  );
}
