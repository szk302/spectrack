import { relative } from "node:path";
import { ExitCode } from "../../output/exit-code.js";
import { SEPARATOR } from "../../output/formatter.js";
import {
  isFileModifiedInWorkingTree,
  getLatestCommitHash,
} from "../../git/git-client.js";
import type { CommandContext } from "../runner.js";

/**
 * `spectrack list`
 *
 * プロジェクト内の全追跡対象ドキュメントのインベントリを表示する。
 * - ファイルパス、ID、現在のバージョン、最終更新日
 * - 未コミット変更がある場合は明示する
 */
export async function runList(ctx: CommandContext): Promise<ExitCode> {
  const docs = ctx.docs;

  console.log(SEPARATOR);
  console.log(`📦 ドキュメント一覧 (全 ${docs.length} ファイル)\n`);

  for (const doc of docs) {
    const relPath = relative(ctx.cwd, doc.filePath);
    const id = doc.frontMatter.id ?? "(ID未設定)";
    const version = doc.currentVersion ?? "?";

    const isModified = await isFileModifiedInWorkingTree(ctx.git, relPath);
    const commitHash = isModified
      ? null
      : await getLatestCommitHash(ctx.git, relPath);

    const versionNote = isModified ? ` (未コミットの変更あり)` : "";

    console.log(`📄 ${relPath} [${id}]`);
    console.log(`   📌 バージョン: ${version}${versionNote}`);

    if (commitHash) {
      // Get commit date
      let commitDate = "";
      try {
        const log = await ctx.git.log({ file: relPath, maxCount: 1 });
        const rawDate = log.latest?.date ?? "";
        // Format: YYYY-MM-DD
        commitDate = rawDate ? rawDate.slice(0, 10) : "";
      } catch {
        commitDate = "";
      }
      const dateStr = commitDate ? ` ${commitDate}` : "";
      console.log(`   🕐 最終コミット:${dateStr} (${commitHash})`);
    } else if (!isModified) {
      console.log(`   🕐 最終コミット: (不明)`);
    }

    console.log();
  }

  return ExitCode.SUCCESS;
}
