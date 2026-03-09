import type { Dependency } from "../types/document.js";
import { isUpdated } from "./semver-utils.js";

export type UpdateStatus = {
  readonly dependency: Dependency;
  readonly currentVersion: string | null;
  readonly commitHash: string | null;
  /** Working tree（未コミット）のバージョンを使用しているか */
  readonly isWorkingTree: boolean;
  readonly hasUpdate: boolean;
};

/**
 * 依存先の更新状態を判定する
 *
 * @param dep - 依存元が参照している依存情報（id + 参照バージョン）
 * @param currentVersion - 依存先の現在のバージョン
 * @param commitHash - 依存先の最新コミットハッシュ（短縮版）
 * @param isWorkingTree - Working treeのバージョンを使用しているか
 * @param strict - パッチ更新も更新とみなすか
 */
export function detectUpdate(
  dep: Dependency,
  currentVersion: string | null,
  commitHash: string | null,
  isWorkingTree = false,
  strict = false,
): UpdateStatus {
  if (!currentVersion) {
    return {
      dependency: dep,
      currentVersion: null,
      commitHash,
      isWorkingTree,
      hasUpdate: false,
    };
  }

  const hasUpdate = isUpdated(dep.version, currentVersion, strict);

  return {
    dependency: dep,
    currentVersion,
    commitHash,
    isWorkingTree,
    hasUpdate,
  };
}
