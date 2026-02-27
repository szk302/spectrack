import { parseDocument } from "yaml";
import type { SimpleGit } from "simple-git";
import { DiffTargetNotFoundError } from "../types/errors.js";
import { resolveVersionFromRaw } from "../version/version-resolver.js";

export type CommitInfo = {
  readonly hash: string;
  readonly shortHash: string;
  readonly date: string;
  readonly version: string | null;
};

/**
 * ファイルの特定バージョンが設定されたコミットを特定する
 *
 * @param git - SimpleGit インスタンス
 * @param relativePath - リポジトリルートからの相対パス
 * @param targetVersion - 特定したいバージョン文字列
 * @param versionPath - バージョンの dotpath (例: "version", "info.version")
 */
export async function findVersionCommit(
  git: SimpleGit,
  relativePath: string,
  targetVersion: string,
  versionPath: string,
): Promise<CommitInfo> {
  // ファイルのコミット履歴を取得
  const log = await git.log({
    file: relativePath,
    format: { hash: "%H", abbrevHash: "%h", date: "%aI" },
  });

  for (const commit of log.all) {
    try {
      const content = await git.show([`${commit.hash}:${relativePath}`]);

      // .md ファイルはフロントマター部分のみ抽出してからパース
      let yamlContent = content;
      if (relativePath.endsWith(".md")) {
        const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(content);
        yamlContent = match ? (match[1] ?? "") : "";
      }

      const yamlDoc = parseDocument(yamlContent);

      if (yamlDoc.errors.length > 0) continue;

      const raw = (yamlDoc.toJSON() ?? {}) as Record<string, unknown>;
      const version = resolveVersionFromRaw(raw, versionPath);

      if (version === targetVersion) {
        return {
          hash: commit.hash,
          shortHash: commit.hash.slice(0, 7),
          date: commit.date,
          version,
        };
      }
    } catch {
      continue;
    }
  }

  throw new DiffTargetNotFoundError(targetVersion);
}

/**
 * ファイルの全バージョン履歴を取得する
 */
export async function getVersionHistory(
  git: SimpleGit,
  relativePath: string,
  versionPath: string,
): Promise<CommitInfo[]> {
  const log = await git.log({
    file: relativePath,
    format: { hash: "%H", abbrevHash: "%h", date: "%aI" },
  });

  const history: CommitInfo[] = [];

  for (const commit of log.all) {
    try {
      const content = await git.show([`${commit.hash}:${relativePath}`]);

      // .md ファイルはフロントマター部分のみ抽出してからパース
      let yamlContent = content;
      if (relativePath.endsWith(".md")) {
        const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(content);
        yamlContent = match ? (match[1] ?? "") : "";
      }

      const yamlDoc = parseDocument(yamlContent);

      if (yamlDoc.errors.length > 0) continue;

      const raw = (yamlDoc.toJSON() ?? {}) as Record<string, unknown>;
      const version = resolveVersionFromRaw(raw, versionPath);

      history.push({
        hash: commit.hash,
        shortHash: commit.hash.slice(0, 7),
        date: commit.date,
        version,
      });
    } catch {
      continue;
    }
  }

  return history;
}

/**
 * HEAD コミット時点のファイルのバージョンを取得する
 */
export async function getCommittedVersion(
  git: SimpleGit,
  relativePath: string,
  versionPath: string,
): Promise<{ version: string | null; commitHash: string | null }> {
  try {
    const content = await git.show([`HEAD:${relativePath}`]);

    // .md ファイルの場合はフロントマター部分のみ抽出
    let yamlContent = content;
    if (relativePath.endsWith(".md")) {
      const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(content);
      yamlContent = match ? (match[1] ?? "") : "";
    }

    const yamlDoc = parseDocument(yamlContent);

    if (yamlDoc.errors.length > 0) {
      return { version: null, commitHash: null };
    }

    const raw = (yamlDoc.toJSON() ?? {}) as Record<string, unknown>;
    const version = resolveVersionFromRaw(raw, versionPath);

    // HEAD のコミットハッシュを取得
    const log = await git.log({ file: relativePath, maxCount: 1 });
    const commitHash = log.latest?.hash?.slice(0, 7) ?? null;

    return { version, commitHash };
  } catch {
    return { version: null, commitHash: null };
  }
}
