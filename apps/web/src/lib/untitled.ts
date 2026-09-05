export function untitledDocument(): string {
  const date = new Date().toISOString().slice(0, 10);
  return `---
title: "Untitled"
date: ${date}
language: it
mdoc:
  version: 1
  page:
    size: A4
    orientation: portrait
  margins:
    top: 20mm
    right: 20mm
    bottom: 20mm
    left: 25mm
  header:
    left: "{{title}}"
    center: ""
    right: "{{page}} / {{pages}}"
  footer:
    left: ""
    center: ""
    right: "{{date}}"
---

# 

`;
}
