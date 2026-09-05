import { z } from "zod";
import { isLength } from "@mdword/shared";

export const lengthSchema = z.string().refine(isLength, {
  message: "Length must be a number followed by mm, cm, in, or pt"
});

export const namedPageSizeSchema = z.enum(["A4", "A3", "A5", "Letter", "Legal"]);

export const customPageSizeSchema = z.object({
  width: lengthSchema,
  height: lengthSchema
});

export const pageSizeSchema = z.union([namedPageSizeSchema, customPageSizeSchema]);

export const textStyleSchema = z
  .object({
    "font-family": z.string().optional(),
    "font-size": lengthSchema.optional(),
    weight: z.union([z.number().int(), z.string()]).optional(),
    "line-height": z.union([z.number(), z.string()]).optional(),
    color: z.string().optional()
  })
  .strict();

export const runningSchema = z
  .object({
    left: z.string().optional(),
    center: z.string().optional(),
    right: z.string().optional()
  })
  .strict();

export const mdocSchema = z
  .object({
    version: z.number().int().min(1).default(1),
    template: z.string().optional(),
    page: z
      .object({
        size: pageSizeSchema.optional(),
        orientation: z.enum(["portrait", "landscape"]).optional()
      })
      .strict()
      .optional(),
    margins: z
      .object({
        top: lengthSchema.optional(),
        right: lengthSchema.optional(),
        bottom: lengthSchema.optional(),
        left: lengthSchema.optional()
      })
      .strict()
      .optional(),
    typography: z.record(textStyleSchema).optional(),
    header: runningSchema.optional(),
    footer: runningSchema.optional(),
    numbering: z
      .object({
        headings: z.boolean().optional(),
        figures: z.boolean().optional(),
        tables: z.boolean().optional()
      })
      .strict()
      .optional(),
    toc: z
      .object({
        enabled: z.boolean().optional(),
        depth: z.number().int().min(1).max(6).optional()
      })
      .strict()
      .optional()
  })
  .passthrough();

export type Mdoc = z.infer<typeof mdocSchema>;
export type TextStyle = z.infer<typeof textStyleSchema>;
export type NamedPageSize = z.infer<typeof namedPageSizeSchema>;

export function parseMdoc(input: unknown): { value: Mdoc; issues: string[] } {
  const result = mdocSchema.safeParse(input ?? {});
  if (result.success) {
    return { value: result.data, issues: [] };
  }
  return {
    value: { version: 1 },
    issues: result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`)
  };
}
