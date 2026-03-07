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
 * パース済みドキュメントから ID レジストリを構築する（重複を許容する版）
 * ID が重複する場合は最初の出現を採用し、後続は無視する。
 * verify コマンド専用。重複の検出は verify.ts が ctx.docs から行う。
 */
export function buildIdRegistryPermissive(
  docs: readonly VersionedDocument[],
  cwd: string,
): IdRegistry {
  const registry = new Map<string, RegistryEntry>();

  for (const doc of docs) {
    const id = doc.frontMatter.id;
    if (!id || registry.has(id)) continue;

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

