import { relative } from "node:path";
import type { RegistryEntry, VersionedDocument } from "../types/document.js";
import { DuplicateIdError } from "../types/errors.js";

export type IdRegistry = ReadonlyMap<string, RegistryEntry>;

/**
 * パース済みドキュメントから ID レジストリを構築する
 * ID の重複がある場合は DuplicateIdError を投げる
 */
export function buildIdRegistry(
  docs: readonly VersionedDocument[],
  cwd: string,
): IdRegistry {
  const registry = new Map<string, RegistryEntry>();

  for (const doc of docs) {
    const id = doc.frontMatter.id;
    if (!id) continue;

    if (registry.has(id)) {
      throw new DuplicateIdError(id);
    }

    registry.set(id, {
      id,
      filePath: doc.filePath,
      relativePath: relative(cwd, doc.filePath),
    });
  }

  return registry;
}

/**
 * ID からファイルパスを解決する
 */
export function resolveId(
  registry: IdRegistry,
  id: string,
): RegistryEntry | undefined {
  return registry.get(id);
}

/**
 * ファイルパスから ID を逆引きする
 */
export function findIdByPath(
  registry: IdRegistry,
  filePath: string,
): string | undefined {
  for (const [id, entry] of registry) {
    if (entry.filePath === filePath) {
      return id;
    }
  }
  return undefined;
}
