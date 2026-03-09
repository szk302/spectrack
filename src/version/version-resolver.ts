import { resolveDotPath } from "../frontmatter/template-engine.js";
import type { ParsedDocument } from "../types/document.js";

/**
 * ParsedDocument からバージョンを解決する
 * x-st-version-path で指定された dotpath でフロントマターからバージョンを取得する
 *
 * @returns バージョン文字列。見つからない場合は null
 */
export function resolveVersion(doc: ParsedDocument): string | null {
  const versionPath = doc.frontMatter.versionPath;
  if (!versionPath) return null;

  const value = resolveDotPath(doc.frontMatter.raw, versionPath);
  if (value === null || value === undefined) return null;

  return String(value);
}

/**
 * YAML Document から dotpath でバージョンを取得する
 * git show で取得した文字列コンテンツに対して使用
 */
export function resolveVersionFromRaw(
  raw: Record<string, unknown>,
  versionPath: string,
): string | null {
  const value = resolveDotPath(raw, versionPath);
  if (value === null || value === undefined) return null;
  return String(value);
}
