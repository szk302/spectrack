import { existsSync } from "node:fs";
import { relative } from "node:path";
import { ExitCode } from "../../output/exit-code.js";
import { printError, SEPARATOR } from "../../output/formatter.js";
import { parseFile } from "../../frontmatter/parser.js";
import { resolveVersion } from "../../version/version-resolver.js";
import { getVersionHistory } from "../../git/history-resolver.js";
import type { CommitInfo } from "../../git/history-resolver.js";
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

  // F2-1: 連続する同一バージョンのエントリを除去し、バージョンが変わった瞬間のみを保持
  const deduplicated: CommitInfo[] = [];
  for (let i = 0; i < history.length; i++) {
    const current = history[i]!;
    const older = history[i + 1]; // より古いコミット
    if (!older || current.version !== older.version) {
      deduplicated.push(current);
    }
  }

  // F2-2 & F2-3: Working Tree のバージョンが最新コミットと異なる場合は先頭に追加
  const currentVersion = resolveVersion(parsed);
  const latestCommitVersion = deduplicated[0]?.version ?? null;
  const workingTreeEntries: Array<{ version: string; isWorkingTree: true }> = [];
  if (currentVersion !== null && currentVersion !== latestCommitVersion) {
    workingTreeEntries.push({ version: currentVersion, isWorkingTree: true });
  }

  if (deduplicated.length === 0 && workingTreeEntries.length === 0) {
    console.log(`  ℹ️  バージョン履歴が見つかりません`);
    return ExitCode.SUCCESS;
  }

  // Working Tree エントリ（未コミット）を先頭に表示
  workingTreeEntries.forEach(({ version }) => {
    console.log(`✨ ${version}  (Working Tree)`);
  });

  // コミット履歴を表示
  deduplicated.forEach((commit, index) => {
    const version = commit.version ?? "(不明)";
    const dateStr = commit.date.slice(0, 19).replace("T", " ");
    const isFirst = index === 0 && workingTreeEntries.length === 0;
    const emoji = isFirst ? "✨" : "📝";
    console.log(`${emoji} ${version}  ${dateStr} (commit: ${commit.shortHash})`);
  });

  return ExitCode.SUCCESS;
}
