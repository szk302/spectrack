import type { Context } from "../types/context.js";

/**
 * テンプレート文字列を Context オブジェクトで展開する
 *
 * テンプレート構文:
 * - `{{dotpath}}` — context オブジェクトの dotpath 記法でアクセス
 * - `{{nanoid}}` — context.macro.nanoid に解決される
 *
 * @example
 * expandTemplate("{{context.file.dir}}-{{nanoid}}", context)
 * // => "prd-V1StGXR8_Z5jdHi6B-myT"
 */
export function expandTemplate(template: string, context: Context): string {
  // テンプレートの root オブジェクト: {{context.file.dir}} のような参照に対応
  const root: Record<string, unknown> = {
    context,
    macro: context.macro,
  };

  return template.replace(/\{\{([^}]+)\}\}/g, (_, path: string) => {
    const trimmed = path.trim();

    // nanoid マクロの短縮形
    if (trimmed === "nanoid") {
      return context.macro.nanoid;
    }

    const value = resolveDotPath(root, trimmed);
    if (value === undefined || value === null) {
      return `{{${trimmed}}}`;
    }
    return String(value);
  });
}

/**
 * dotpath 記法でオブジェクトから値を取得する
 * @example
 * resolveDotPath({ a: { b: "value" } }, "a.b") // => "value"
 */
export function resolveDotPath(
  obj: unknown,
  path: string,
): unknown {
  const parts = path.split(".");
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined;
    }
    if (typeof current !== "object") {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}
