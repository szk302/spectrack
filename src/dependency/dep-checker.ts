import { parseDocument } from "yaml";
import type { SimpleGit } from "simple-git";
import type { VersionedDocument } from "../types/document.js";
import type { IdRegistry } from "../scanner/id-registry.js";
import { resolveId } from "../scanner/id-registry.js";
import { getFileAtCommit } from "../git/git-client.js";
import { detectUpdate, type UpdateStatus } from "../version/update-detector.js";
import { DependencyNotFoundError } from "../types/errors.js";
import { estimateDeletedFilePath } from "../git/file-tracker.js";
import { resolveVersionFromRaw } from "../version/version-resolver.js";

export type DepCheckResult = {
  /** 依存元ドキュメント */
  readonly doc: VersionedDocument;
  /** 各依存先の更新状態 */
  readonly statuses: readonly UpdateStatus[];
  /** エラーがあった依存先 */
  readonly errors: readonly { id: string; error: Error }[];
};

/**
 * 指定ドキュメントの依存先をチェックする
 *
 * 評価基準 (spec §5):
 * - 依存元（参照側）: Working tree（現在のファイルシステム）
 * - 依存先（被参照側）: Gitの最新コミット状態 (HEAD)
 *
 * @param doc - チェック対象のドキュメント（Working tree の状態）
 * @param registry - IDレジストリ
 * @param git - SimpleGit インスタンス
 * @param strict - パッチ更新も更新とみなすか
 */
export async function checkDocDeps(
  doc: VersionedDocument,
  registry: IdRegistry,
  git: SimpleGit,
  strict = false,
): Promise<DepCheckResult> {
  const statuses: UpdateStatus[] = [];
  const errors: { id: string; error: Error }[] = [];

  for (const dep of doc.frontMatter.dependencies) {
    const entry = resolveId(registry, dep.id);

    if (!entry) {
      // ファイルが削除された可能性 → Git 履歴から推定
      const estimatedPath = await estimateDeletedFilePath(git, dep.id);
      const err = new DependencyNotFoundError(dep.id, estimatedPath ?? undefined);
      errors.push({ id: dep.id, error: err });
      continue;
    }

    // 依存先の HEAD コミット時点のファイル内容を取得
    const committedContent = await getFileAtCommit(
      git,
      "HEAD",
      entry.relativePath,
    );

    if (!committedContent) {
      errors.push({
        id: dep.id,
        error: new DependencyNotFoundError(dep.id),
      });
      continue;
    }

    // コミット済みコンテンツをパースして versionPath とバージョンを取得
    const { version: committedVersion, commitHash } =
      extractVersionFromCommittedContent(committedContent, entry.relativePath);

    // 依存先の最新コミットハッシュを取得
    let latestHash: string | null = commitHash;
    if (!latestHash) {
      try {
        const log = await git.log({ file: entry.relativePath, maxCount: 1 });
        latestHash = log.latest?.hash?.slice(0, 7) ?? null;
      } catch {
        latestHash = null;
      }
    }

    statuses.push(detectUpdate(dep, committedVersion, latestHash, strict));
  }

  return { doc, statuses, errors };
}

/**
 * コミット済みファイルコンテンツから versionPath とバージョンを抽出する
 */
function extractVersionFromCommittedContent(
  content: string,
  relativePath: string,
): { version: string | null; commitHash: string | null } {
  try {
    // .md ファイルの場合はフロントマター部分を抽出
    let yamlContent = content;
    if (relativePath.endsWith(".md")) {
      const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(content);
      yamlContent = match ? (match[1] ?? "") : "";
    }

    const yamlDoc = parseDocument(yamlContent);
    if (yamlDoc.errors.length > 0) return { version: null, commitHash: null };

    const raw = (yamlDoc.toJSON() ?? {}) as Record<string, unknown>;
    const versionPath =
      typeof raw["x-st-version-path"] === "string"
        ? raw["x-st-version-path"]
        : "version";

    const version = resolveVersionFromRaw(raw, versionPath);
    return { version, commitHash: null };
  } catch {
    return { version: null, commitHash: null };
  }
}
