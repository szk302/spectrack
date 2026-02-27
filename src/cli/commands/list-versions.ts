import { existsSync } from "node:fs";
import { relative } from "node:path";
import { ExitCode } from "../../output/exit-code.js";
import { printError, SEPARATOR } from "../../output/formatter.js";
import { parseFile } from "../../frontmatter/parser.js";
import { resolveVersion } from "../../version/version-resolver.js";
import type { CommandContext } from "../runner.js";

export async function runListVersions(
  filePath: string | undefined,
  ctx: CommandContext,
): Promise<ExitCode> {
  const targetDocs = filePath
    ? (() => {
        if (!existsSync(filePath)) {
          printError(`ERROR: ファイル [${filePath}] が見つかりません`);
          return null;
        }
        const parsed = parseFile(filePath, ctx.cwd);
        const currentVersion = resolveVersion(parsed);
        return [{ ...parsed, currentVersion }];
      })()
    : ctx.docs;

  if (!targetDocs) return ExitCode.ERROR;

  for (const doc of targetDocs) {
    const id = doc.frontMatter.id ?? "(不明)";
    const relPath = relative(ctx.cwd, doc.filePath);
    const version = doc.currentVersion ?? "?";

    // 最終更新コミット情報を取得
    let lastCommitDate: string | null = null;
    let lastCommitHash: string | null = null;

    try {
      const log = await ctx.git.log({
        file: relPath,
        maxCount: 1,
        format: { hash: "%H", date: "%aI" },
      });
      if (log.latest) {
        lastCommitHash = log.latest.hash.slice(0, 7);
        lastCommitDate = log.latest.date
          ? new Date(log.latest.date).toISOString().split("T")[0] ?? null
          : null;
      }
    } catch {
      // ignore
    }

    console.log(SEPARATOR);
    console.log(`📄 [${id}] ${relPath}`);
    console.log(`   📌 現在: ${version}`);
    if (lastCommitDate && lastCommitHash) {
      console.log(
        `   🕐 最終更新: ${lastCommitDate} (commit: ${lastCommitHash})`,
      );
    } else {
      console.log(`   🕐 最終更新: (コミット情報なし)`);
    }
  }

  return ExitCode.SUCCESS;
}
