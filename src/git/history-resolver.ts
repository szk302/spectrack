import { parseDocument } from "yaml";
import type { SimpleGit } from "simple-git";
import { DiffTargetNotFoundError } from "../types/errors.js";
import { resolveVersionFromRaw } from "../version/version-resolver.js";

export type CommitInfo = {
  readonly hash: string;
  readonly shortHash: string;
  readonly date: string;
  readonly version: string | null;
  /** リネーム追跡時のコミット時点のファイルパス（省略時は呼び出し元のパスと同一） */
  readonly filePath?: string;
};

/**
 * `git log --follow --name-only` の出力をパースして
 * コミットごとの {hash, date, filePath} を返す
 */
function parseFollowLog(
  rawLog: string,
): Array<{ hash: string; date: string; filePath: string }> {
  const entries: Array<{ hash: string; date: string; filePath: string }> = [];
  let currentHash = "";
  let currentDate = "";

  for (const line of rawLog.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (trimmed.startsWith("COMMIT:")) {
      const rest = trimmed.slice("COMMIT:".length);
      const tabIdx = rest.indexOf("\t");
      if (tabIdx !== -1) {
        currentHash = rest.slice(0, tabIdx);
        currentDate = rest.slice(tabIdx + 1);
      }
    } else if (currentHash) {
      entries.push({ hash: currentHash, date: currentDate, filePath: trimmed });
    }
  }

  return entries;
}

/**
 * ファイルの特定バージョンが設定されたコミットを特定する
 *
 * `--follow` によりリネーム後のファイルも履歴を遡って検索する。
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
  // --follow でリネーム追跡しながらコミット履歴とファイルパスを取得
  const rawLog = await git.raw([
    "log",
    "--follow",
    "--name-only",
    "--format=COMMIT:%H\t%aI",
    "--",
    relativePath,
  ]);

  const entries = parseFollowLog(rawLog);

  for (const { hash, date, filePath } of entries) {
    try {
      const content = await git.show([`${hash}:${filePath}`]);

      // .md ファイルはフロントマター部分のみ抽出してからパース
      let yamlContent = content;
      if (filePath.endsWith(".md")) {
        const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(content);
        yamlContent = match ? (match[1] ?? "") : "";
      }

      const yamlDoc = parseDocument(yamlContent);

      if (yamlDoc.errors.length > 0) continue;

      const raw = (yamlDoc.toJSON() ?? {}) as Record<string, unknown>;
      const version = resolveVersionFromRaw(raw, versionPath);

      if (version === targetVersion) {
        return {
          hash,
          shortHash: hash.slice(0, 7),
          date,
          version,
          filePath,
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
 *
 * `--follow` によりリネーム後のファイルも履歴を遡って検索する。
 */
export async function getVersionHistory(
  git: SimpleGit,
  relativePath: string,
  versionPath: string,
): Promise<CommitInfo[]> {
  // --follow でリネーム追跡しながらコミット履歴とファイルパスを取得
  const rawLog = await git.raw([
    "log",
    "--follow",
    "--name-only",
    "--format=COMMIT:%H\t%aI",
    "--",
    relativePath,
  ]);

  const entries = parseFollowLog(rawLog);
  const history: CommitInfo[] = [];

  for (const { hash, date, filePath } of entries) {
    try {
      const content = await git.show([`${hash}:${filePath}`]);

      // .md ファイルはフロントマター部分のみ抽出してからパース
      let yamlContent = content;
      if (filePath.endsWith(".md")) {
        const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(content);
        yamlContent = match ? (match[1] ?? "") : "";
      }

      const yamlDoc = parseDocument(yamlContent);

      if (yamlDoc.errors.length > 0) continue;

      const raw = (yamlDoc.toJSON() ?? {}) as Record<string, unknown>;
      const version = resolveVersionFromRaw(raw, versionPath);

      history.push({
        hash,
        shortHash: hash.slice(0, 7),
        date,
        version,
        filePath,
      });
    } catch {
      continue;
    }
  }

  return history;
}

