export interface PluginManifest {
  id: string;
  version: string;
  name: string;
  description?: string;
  permissions: string[];
}

export interface DirectiveDefinition {
  name: string;
  alias?: string[];
}

export interface Command {
  id: string;
  title: string;
  shortcut?: string;
}

export interface RendererExtension {
  nodeType: string;
}

export interface MDocPlugin {
  id: string;
  version: string;
  manifest: PluginManifest;
  directives?: DirectiveDefinition[];
  commands?: Command[];
  renderers?: RendererExtension[];
}

export const bundledPlugins: MDocPlugin[] = [
  {
    id: "mdword.page-break",
    version: "1.0.0",
    manifest: {
      id: "mdword.page-break",
      version: "1.0.0",
      name: "Page break",
      permissions: []
    },
    directives: [{ name: "page-break" }],
    commands: [{ id: "insert.pageBreak", title: "Insert page break" }]
  },
  {
    id: "mdword.wikilink",
    version: "1.0.0",
    manifest: {
      id: "mdword.wikilink",
      version: "1.0.0",
      name: "Wikilinks",
      description: "Isolated [[wikilink]] extension",
      permissions: []
    },
    commands: [{ id: "insert.wikilink", title: "Insert wikilink" }]
  }
];
