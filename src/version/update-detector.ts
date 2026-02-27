import type { Dependency } from "../types/document.js";
import { isUpdated } from "./semver-utils.js";

export type UpdateStatus = {
  readonly dependency: Dependency;
  readonly currentVersion: string | null;
  readonly commitHash: string | null;
  readonly hasUpdate: boolean;
};

/**
 * 依存先の更新状態を判定する
 *
 * @param dep - 依存元が参照している依存情報（id + 参照バージョン）
 * @param currentVersion - 依存先の現在のバージョン（Gitの最新コミット状態）
 * @param commitHash - 依存先の最新コミットハッシュ（短縮版）
 * @param strict - パッチ更新も更新とみなすか
 */
export function detectUpdate(
  dep: Dependency,
  currentVersion: string | null,
  commitHash: string | null,
  strict = false,
): UpdateStatus {
  if (!currentVersion) {
    return {
      dependency: dep,
      currentVersion: null,
      commitHash,
      hasUpdate: false,
    };
  }

  const hasUpdate = isUpdated(dep.version, currentVersion, strict);

  return {
    dependency: dep,
    currentVersion,
    commitHash,
    hasUpdate,
  };
}
