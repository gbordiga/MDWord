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

/** Resolve metadata tokens but keep {{page}} / {{pages}} for print engines. */
export function resolveRunningForPrint(template: string, ctx: VariableContext): string {
  return resolveVariables(template, { ...ctx, page: "{{page}}", pages: "{{pages}}" });
}

/** Screen preview: page 1 of an unknown total. */
export function resolveRunningForPreview(template: string, ctx: VariableContext): string {
  return resolveVariables(template, { ...ctx, page: ctx.page ?? "1", pages: "…" });
}
