import type { ReactNode } from "react";
import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MDWord",
  description: "Structured document editor with MyST Markdown as the source of truth.",
  appleWebApp: {
    capable: true,
    title: "MDWord",
    statusBarStyle: "default"
  },
  formatDetection: {
    telephone: false
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#ffffff",
  interactiveWidget: "resizes-content"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="it">
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
