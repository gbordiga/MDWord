# ADR-009 PDF rendering

## Status

Accepted

## Context

PDF must match the document's page size, margins, and headers. Headless HTML-to-PDF with Chromium is the same engine as Electron.

## Decision

Generate semantic HTML from the AST + cascade. Desktop: hidden `BrowserWindow.printToPDF` with `displayHeaderFooter`. Web: print stylesheet and the browser print dialog (user chooses “Save as PDF”). Do not use DOCX or LaTeX as an intermediate for MVP.

## Consequences

Web PDF download is mediated by the browser. Desktop can write a `.pdf` file atomically.
