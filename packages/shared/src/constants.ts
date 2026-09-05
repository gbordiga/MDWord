export const APP_NAME = "MDWord";
export const APP_VERSION = "0.1.0";
export const MDOC_VERSION = 1;
export const PAGE_BREAK_DIRECTIVE = "page-break";

export type DiagnosticSeverity = "error" | "warning" | "info";

export interface Diagnostic {
  severity: DiagnosticSeverity;
  message: string;
  line?: number;
  column?: number;
  code?: string;
}

export type GenericNode = {
  type: string;
  children?: GenericNode[];
  value?: string;
  [key: string]: unknown;
};

export type GenericParent = GenericNode & { children: GenericNode[] };
