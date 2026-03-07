import { simpleGit, type SimpleGit } from "simple-git";
import {
  GitNoCommitsError,
  GitNotInitializedError,
} from "../types/errors.js";

/**
 * Git クライアントを初期化して返す
 * リポジトリが初期化されていない場合は null を返す（エラーを投げない）
 */
export async function createGitClientOptional(cwd: string): Promise<SimpleGit | null> {
  try {
    return await createGitClient(cwd);
  } catch {
    return null;
  }
}

/**
 * Git クライアントを初期化して返す
 * リポジトリが初期化されていない場合はエラーを投げる
 */
export async function createGitClient(cwd: string): Promise<SimpleGit> {
  const git = simpleGit(cwd);

  try {
    const isRepo = await git.checkIsRepo();
    if (!isRepo) {
      throw new GitNotInitializedError();
    }
  } catch (err) {
    if (err instanceof GitNotInitializedError) throw err;
    throw new GitNotInitializedError();
  }

  // コミットが存在するか確認
  try {
    await git.log({ maxCount: 1 });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : String(err);
    throw new GitNoCommitsError(message);
  }

  return git;
}

/**
 * 指定ファイルの最新コミットハッシュ（短縮版）を取得する
 */
export async function getLatestCommitHash(
  git: SimpleGit,
  filePath: string,
): Promise<string | null> {
  try {
    const log = await git.log({
      file: filePath,
      maxCount: 1,
      format: { hash: "%H", abbrevHash: "%h" },
    });
    return log.latest?.hash?.slice(0, 7) ?? null;
  } catch {
    return null;
  }
}

/**
 * git log -S でIDを含む過去のファイルパスを推定する
 * 削除されたファイルの追跡に使用
 */
export async function findHistoricalPath(
  git: SimpleGit,
  searchString: string,
): Promise<string | null> {
  try {
    const result = await git.raw([
      "log",
      `-S${searchString}`,
      "--name-only",
      "--format=%H",
      "--diff-filter=D",
    ]);

    const lines = result.split("\n").filter((l) => l.trim().length > 0);
    // コミットハッシュでない行がファイルパス
    for (const line of lines) {
      if (!/^[0-9a-f]{40}$/i.test(line.trim())) {
        return line.trim();
      }
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * 指定IDを過去に含んでいたファイルパスとその最終コミットハッシュを返す
 * `git log -S` を用いて全コミット履歴を検索する
 */
export async function findHistoricalDependentFiles(
  git: SimpleGit,
  targetId: string,
): Promise<Array<{ filePath: string; commitHash: string }>> {
  try {
    const result = await git.raw([
      "log",
      "--all",
      `-S${targetId}`,
      "--name-only",
      "--format=COMMIT:%H",
    ]);

    const lines = result.split("\n");
    const fileMap = new Map<string, string>(); // filePath -> commitHash (最初に見つかったもの=最新)
    let currentCommit = "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      if (trimmed.startsWith("COMMIT:")) {
        currentCommit = trimmed.slice(7, 14); // 7文字の短縮ハッシュ
      } else if (currentCommit) {
        if (!fileMap.has(trimmed)) {
          fileMap.set(trimmed, currentCommit);
        }
      }
    }

    return Array.from(fileMap.entries()).map(([filePath, commitHash]) => ({
      filePath,
      commitHash,
    }));
  } catch {
    return [];
  }
}

/**
 * 指定ファイルがWorking treeで未コミットの変更を持つか確認する
 */
export async function isFileModifiedInWorkingTree(
  git: SimpleGit,
  relativePath: string,
): Promise<boolean> {
  try {
    const result = await git.raw(["status", "--porcelain", relativePath]);
    return result.trim().length > 0;
  } catch {
    return false;
  }
}

