export interface VariableContext {
  title?: string;
  subtitle?: string;
  author?: string;
  date?: string;
  page?: number | string;
  pages?: number | string;
  filename?: string;
  section?: string;
  [key: string]: string | number | undefined;
}

const VAR_RE = /\{\{\s*([a-zA-Z][a-zA-Z0-9_-]*)\s*\}\}/g;

export function resolveVariables(template: string, ctx: VariableContext): string {
  return template.replace(VAR_RE, (_, name: string) => {
    const value = ctx[name];
    return value === undefined || value === null ? "" : String(value);
  });
}
