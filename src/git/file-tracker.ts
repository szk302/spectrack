import type { SimpleGit } from "simple-git";
import { findHistoricalPath } from "./git-client.js";

/**
 * 削除されたファイルの推定パスを取得する
 * git log -S でIDが含まれていた過去のファイルパスを検索する
 */
export async function estimateDeletedFilePath(
  git: SimpleGit,
  id: string,
): Promise<string | null> {
  return findHistoricalPath(git, id);
}
