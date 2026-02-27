import type { Dependency } from "../types/document.js";
import type { IdRegistry } from "../scanner/id-registry.js";
import { resolveId } from "../scanner/id-registry.js";

/**
 * 依存先リストの path ヒントを最新のレジストリ情報で更新する
 *
 * path フィールドはあくまで人間向けの補助情報。追跡の正は id。
 * ID がレジストリに存在しない場合は変更しない（削除ファイル等）。
 */
export function updatePathHints(
  deps: readonly Dependency[],
  registry: IdRegistry,
): readonly Dependency[] {
  return deps.map((dep) => {
    const entry = resolveId(registry, dep.id);
    if (entry === undefined) {
      return dep;
    }
    return {
      id: dep.id,
      path: entry.relativePath,
      version: dep.version,
    };
  });
}
