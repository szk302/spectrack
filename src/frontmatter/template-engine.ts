import type { Context } from "../types/context.js";

/**
 * テンプレート文字列を Context オブジェクトで展開する
 *
 * テンプレート構文:
 * - `{{dotpath}}` — context オブジェクトの dotpath 記法でアクセス
 * - `{{context.utils.nanoid}}` — nanoid を生成
 * - `{{nanoid}}` — context.utils.nanoid の短縮形（後方互換）
 *
 * @example
 * expandTemplate("{{context.file.dir}}-{{context.utils.nanoid}}", context)
 * // => "prd-V1StGXR8_Z5jdHi6B-myT"
 */
export function expandTemplate(template: string, context: Context): string {
  const root: Record<string, unknown> = {
    context,
  };

  return template.replace(/\{\{([^}]+)\}\}/g, (_, path: string) => {
    const trimmed = path.trim();

    // nanoid 短縮形（後方互換）
    if (trimmed === "nanoid") {
      return context.utils.nanoid;
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
