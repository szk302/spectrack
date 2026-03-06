import { existsSync } from "node:fs";
import type { SimpleGit } from "simple-git";
import type { VersionedDocument } from "../types/document.js";
import type { IdRegistry } from "../scanner/id-registry.js";
import { resolveId } from "../scanner/id-registry.js";
import { parseFile } from "../frontmatter/parser.js";
import { resolveVersion } from "../version/version-resolver.js";
import {
  getLatestCommitHash,
  isFileModifiedInWorkingTree,
} from "../git/git-client.js";
import { detectUpdate, type UpdateStatus } from "../version/update-detector.js";
import { DependencyNotFoundError, InvalidFrontMatterError } from "../types/errors.js";
import { estimateDeletedFilePath } from "../git/file-tracker.js";
import { isValidSemVer } from "../version/semver-utils.js";

export type DepCheckResult = {
  /** 依存元ドキュメント */
  readonly doc: VersionedDocument;
  /** 各依存先の更新状態 */
  readonly statuses: readonly UpdateStatus[];
  /** エラーがあった依存先 */
  readonly errors: readonly { id: string; error: Error }[];
  /** 無効な SemVer を持つ依存先への警告 */
  readonly semverWarnings: readonly { id: string; file: string; version: string }[];
};

/**
 * 指定ドキュメントの依存先をチェックする
 *
 * 評価基準 (spec v2 §5 Working Tree ファースト):
 * - 依存元（参照側）: Working tree（現在のファイルシステム）
 * - 依存先（被参照側）: Working tree を正として比較
 *   - 未コミットの変更がある場合は isWorkingTree=true で表示
 *   - 変更がない場合はコミットハッシュを表示
 *
 * @param doc - チェック対象のドキュメント（Working tree の状態）
 * @param registry - IDレジストリ
 * @param git - SimpleGit インスタンス
 * @param cwd - 作業ディレクトリ（絶対パス）
 * @param strict - パッチ更新も更新とみなすか
 */
export async function checkDocDeps(
  doc: VersionedDocument,
  registry: IdRegistry,
  git: SimpleGit,
  cwd: string,
  strict = false,
): Promise<DepCheckResult> {
  const statuses: UpdateStatus[] = [];
  const errors: { id: string; error: Error }[] = [];
  const semverWarnings: { id: string; file: string; version: string }[] = [];

  for (const dep of doc.frontMatter.dependencies) {
    const entry = resolveId(registry, dep.id);

    if (!entry) {
      // ファイルが削除された可能性 → Git 履歴から推定
      const estimatedPath = await estimateDeletedFilePath(git, dep.id);
      const err = new DependencyNotFoundError(dep.id, estimatedPath ?? undefined);
      errors.push({ id: dep.id, error: err });
      continue;
    }

    // Working tree-first: ファイルシステムから読み込む
    if (!existsSync(entry.filePath)) {
      errors.push({
        id: dep.id,
        error: new DependencyNotFoundError(dep.id),
      });
      continue;
    }

    let depDoc;
    try {
      depDoc = parseFile(entry.filePath, cwd);
    } catch (e) {
      if (e instanceof InvalidFrontMatterError) {
        errors.push({ id: dep.id, error: e });
        continue;
      }
      throw e;
    }

    const currentVersion = resolveVersion(depDoc);

    // バージョン情報が取得できない場合はエラー (F6-1)
    if (currentVersion === null) {
      errors.push({
        id: dep.id,
        error: new Error(`依存先 [${dep.id}] のバージョン情報が見つかりません`),
      });
      continue;
    }

    // 無効な SemVer の場合は警告 (V3-3)
    if (!isValidSemVer(currentVersion)) {
      semverWarnings.push({ id: dep.id, file: entry.relativePath, version: currentVersion });
    }

    // 未コミットの変更があるか確認
    const isWorkTree = await isFileModifiedInWorkingTree(git, entry.relativePath);

    // コミットハッシュ（Working tree 変更がない場合のみ取得）
    const commitHash = isWorkTree
      ? null
      : await getLatestCommitHash(git, entry.relativePath);

    statuses.push(detectUpdate(dep, currentVersion, commitHash, isWorkTree, strict));
  }

  return { doc, statuses, errors, semverWarnings };
}
