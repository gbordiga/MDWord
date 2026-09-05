# Plugin API

MVP ships **first-party extensions only**. Third-party JavaScript is not loaded into the privileged renderer.

The API is designed so a future release can sandbox, permission, and version plugins.

## Manifest

```json
{
  "id": "mdword.page-break",
  "version": "1.0.0",
  "name": "Page break",
  "description": "Explicit page break directive",
  "permissions": []
}
```

## Registration surface

```ts
interface MDocPlugin {
  id: string;
  version: string;
  manifest: PluginManifest;
  directives?: DirectiveDefinition[];
  editorExtensions?: unknown[];
  commands?: Command[];
  renderers?: RendererExtension[];
}
```

A plugin may register:

- a MyST directive / role
- an AST node mapping
- a visual editor node
- a command (palette + shortcut)
- HTML and print renderers
- a serializer handler
- inspector fields

## Rules

1. Add **semantics**, not decoration.
2. Unknown plugins must leave source intact.
3. Never run document-supplied JavaScript.
4. Good examples: `requirement`, `decision`, `revision-history`.
5. Bad examples: `floating-box`, `absolute-image`.

Built-in v1 plugins: `page-break`, `wikilink`, admonitions, figure.
