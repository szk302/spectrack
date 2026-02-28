import { z } from "zod";
import type { Config, FrontMatterTemplates } from "../types/config.js";
import { DEFAULT_CONFIG } from "../types/config.js";

const frontMatterTemplateEntrySchema = z
  .record(z.string(), z.unknown())
  .optional();

const frontMatterTemplatesSchema = z
  .object({
    md: frontMatterTemplateEntrySchema,
    yml: frontMatterTemplateEntrySchema,
    yaml: frontMatterTemplateEntrySchema,
  })
  .optional();

export const configSchema = z.object({
  frontMatterKeyPrefix: z
    .string()
    .default(DEFAULT_CONFIG.frontMatterKeyPrefix),
  frontMatterTemplate: frontMatterTemplatesSchema.transform(
    (val): FrontMatterTemplates =>
      (val as FrontMatterTemplates | undefined) ?? DEFAULT_CONFIG.frontMatterTemplate,
  ),
});

export type ConfigInput = z.input<typeof configSchema>;

export function parseConfig(raw: unknown): Config {
  const result = configSchema.safeParse(raw ?? {});
  if (!result.success) {
    throw new Error(
      `設定ファイルの形式が不正です: ${result.error.message}`,
    );
  }
  return result.data as Config;
}
