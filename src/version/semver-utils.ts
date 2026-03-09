import semver from "semver";
import {
  InvalidPrereleaseError,
  InvalidSemVerWarning,
} from "../types/errors.js";

/**
 * バージョン文字列を検証する
 * - 有効な SemVer であること
 * - プレリリース識別子は数値のみ許可 (例: 1.0.0-1)
 * @throws InvalidPrereleaseError プレリリースに英字が含まれる場合
 * @throws InvalidSemVerWarning 有効なSemVerでない場合（終了コード2）
 */
export function validateVersion(version: string, filePath?: string): void {
  const parsed = semver.parse(version, { loose: false });

  if (!parsed) {
    throw new InvalidSemVerWarning(filePath ?? version, version);
  }

  // プレリリース識別子の検証: 数値のみ許可
  for (const pre of parsed.prerelease) {
    if (typeof pre === "string") {
      // 英字を含む場合はエラー
      throw new InvalidPrereleaseError();
    }
  }
}

/**
 * バージョンが更新されているかチェックする
 * spec §5 のルールに従う
 *
 * @param referenceVersion - 依存元が参照しているバージョン
 * @param currentVersion - 依存先の現在のバージョン
 * @param strict - パッチ更新も更新とみなすか
 * @returns true: 更新あり, false: 更新なし
 */
export function isUpdated(
  referenceVersion: string,
  currentVersion: string,
  strict = false,
): boolean {
  const ref = semver.parse(referenceVersion, { loose: false });
  const cur = semver.parse(currentVersion, { loose: false });

  if (!ref || !cur) {
    // パースできない場合は文字列比較
    return referenceVersion !== currentVersion;
  }

  // メジャーバージョンの更新 → 常に更新あり
  if (cur.major > ref.major) return true;
  if (cur.major < ref.major) return true;

  // 同じメジャーの場合: マイナーバージョンの更新
  // 0.x.x の場合もマイナー更新は更新あり
  if (cur.minor !== ref.minor) return true;

  // パッチバージョンの更新
  if (cur.patch !== ref.patch) {
    return strict;
  }

  // プレリリース比較
  const cmp = semver.compare(cur, ref);
  if (cmp !== 0) {
    return strict;
  }

  return false;
}

/**
 * SemVer が有効かチェックする
 */
export function isValidSemVer(version: string): boolean {
  return semver.parse(version, { loose: false }) !== null;
}
