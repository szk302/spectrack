import { existsSync } from "node:fs";
import { relative } from "node:path";
import { ExitCode } from "../../output/exit-code.js";
import { printError, SEPARATOR } from "../../output/formatter.js";
import { parseFile } from "../../frontmatter/parser.js";
import { getVersionHistory } from "../../git/history-resolver.js";
import type { CommandContext } from "../runner.js";

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export type LogOptions = {};

/**
 * `spectrack log <file>`
 *
 * 指定ドキュメントのバージョン変更履歴をタイムライン形式で表示する。
 * このコマンドのみ Git コミット履歴を正として動作する。
 */
export async function runLog(
  filePath: string,
  _options: LogOptions,
  ctx: CommandContext,
): Promise<ExitCode> {
  if (!existsSync(filePath)) {
    printError(`ERROR: ファイル [${filePath}] が見つかりません`);
    return ExitCode.ERROR;
  }

  const parsed = parseFile(filePath, ctx.cwd);
  const relativePath = relative(ctx.cwd, filePath);
  const versionPath = parsed.frontMatter.versionPath ?? "version";

  console.log(`🕒 バージョン履歴: ${relativePath}`);
  console.log(SEPARATOR);

  const history = await getVersionHistory(ctx.git, relativePath, versionPath);

  if (history.length === 0) {
    console.log(`  ℹ️  バージョン履歴が見つかりません`);
    return ExitCode.SUCCESS;
  }

  history.forEach((commit, index) => {
    const version = commit.version ?? "(不明)";
    const dateStr = commit.date.slice(0, 19).replace("T", " ");
    const emoji = index === 0 ? "✨" : "📝";
    console.log(`${emoji} ${version}  ${dateStr} (commit: ${commit.shortHash})`);
  });

  return ExitCode.SUCCESS;
}
