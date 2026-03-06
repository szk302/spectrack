import { relative } from "node:path";
import { statSync } from "node:fs";
import { ExitCode } from "../../output/exit-code.js";
import { SEPARATOR } from "../../output/formatter.js";
import {
  isFileModifiedInWorkingTree,
  getLatestCommitHash,
} from "../../git/git-client.js";
import type { ListCommandContext } from "../runner.js";

/**
 * `spectrack list`
 *
 * プロジェクト内の全追跡対象ドキュメントのインベントリを表示する。
 * - ファイルパス、ID、現在のバージョン、最終更新日
 * - Git 未初期化環境や未追跡ファイルは OS mtime をフォールバックとして使用する
 */
export async function runList(ctx: ListCommandContext): Promise<ExitCode> {
  const docs = ctx.docs;

  console.log(SEPARATOR);
  console.log(`📦 ドキュメント一覧 (全 ${docs.length} ファイル)\n`);

  if (docs.length === 0) {
    console.log("追跡対象のドキュメントがありません");
    return ExitCode.SUCCESS;
  }

  for (const doc of docs) {
    const relPath = relative(ctx.cwd, doc.filePath);
    const id = doc.frontMatter.id ?? "(ID未設定)";
    const version = doc.currentVersion ?? "?";

    if (ctx.git === null) {
      // Git 未初期化: mtime フォールバック
      console.log(`📄 ${relPath} [${id}]`);
      console.log(`   📌 バージョン: ${version}`);
      console.log(`   🕐 最終更新: ${getMtime(doc.filePath)} (Git未管理・OSタイムスタンプ)`);
    } else {
      const isModified = await isFileModifiedInWorkingTree(ctx.git, relPath);
      const commitHash = await getLatestCommitHash(ctx.git, relPath);

      const versionNote = isModified && commitHash ? ` (未コミットの変更あり)` : "";

      console.log(`📄 ${relPath} [${id}]`);
      console.log(`   📌 バージョン: ${version}${versionNote}`);

      if (commitHash) {
        let commitDate = "";
        try {
          const log = await ctx.git.log({ file: relPath, maxCount: 1 });
          const rawDate = log.latest?.date ?? "";
          commitDate = rawDate ? rawDate.slice(0, 10) : "";
        } catch {
          commitDate = "";
        }
        const dateStr = commitDate ? ` ${commitDate}` : "";
        console.log(`   🕐 最終コミット:${dateStr} (${commitHash})`);
      } else {
        // 未追跡の新規ファイル: mtime フォールバック
        console.log(`   🕐 最終更新: ${getMtime(doc.filePath)} (Git未管理・OSタイムスタンプ)`);
      }
    }

    console.log();
  }

  return ExitCode.SUCCESS;
}

function getMtime(filePath: string): string {
  try {
    const mtime = statSync(filePath).mtime;
    return mtime.toISOString().slice(0, 10);
  } catch {
    return "(不明)";
  }
}
