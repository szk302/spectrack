import { existsSync } from "node:fs";
import { relative } from "node:path";
import { ExitCode } from "../../output/exit-code.js";
import { printError, SEPARATOR } from "../../output/formatter.js";
import { parseFile } from "../../frontmatter/parser.js";
import { resolveVersion } from "../../version/version-resolver.js";
import {
  findVersionCommit,
  getVersionHistory,
} from "../../git/history-resolver.js";
import { DiffTargetNotFoundError } from "../../types/errors.js";
import type { CommandContext } from "../runner.js";

export type DiffOptions = {
  readonly version?: string;
  readonly full?: boolean;
  readonly context?: number;
};

/**
 * `spectrack diff <file> [--version=<version>] [--full | --context=<lines>]`
 *
 * 指定ドキュメント自身の過去バージョンと Working Tree との差分を表示する。
 * - `--version=<version>` 省略時は直前のバージョンを自動取得する。
 * - `--full` でファイル全体のコンテキストを表示、`--context=<lines>` で前後行数を制御する。
 *
 * このコマンドは Git 履歴を参照するため、Working Tree ファーストの例外に該当する。
 */
export async function runDiff(
  filePath: string,
  options: DiffOptions,
  ctx: CommandContext,
): Promise<ExitCode> {
  const relPath = relative(ctx.cwd, filePath);

  if (!existsSync(filePath)) {
    printError(`ERROR: ファイル [${relPath}] が見つかりません`);
    return ExitCode.ERROR;
  }

  const parsed = parseFile(filePath, ctx.cwd);

  if (!parsed.frontMatter.versionPath && !parsed.frontMatter.id) {
    printError(
      `ERROR: [${relPath}] は初期化されていません。spectrack init を実行してください`,
    );
    return ExitCode.ERROR;
  }

  const versionPath = parsed.frontMatter.versionPath ?? "version";
  const currentVersion = resolveVersion(parsed);

  // バージョンを決定（省略時: 直前のバージョンを Git 履歴から自動取得）
  let targetVersion = options.version;
  if (!targetVersion) {
    const history = await getVersionHistory(ctx.git, relPath, versionPath);

    if (history.length === 0) {
      console.log(`ℹ️  比較対象の過去バージョンが見つかりません`);
      return ExitCode.SUCCESS;
    }

    // Working tree のバージョンが最新コミットと異なる → 最新コミットが直前バージョン
    if (currentVersion !== history[0]?.version && history[0]?.version) {
      targetVersion = history[0].version;
    } else if (history.length >= 2 && history[1]?.version) {
      // Working tree = 最新コミット → 2番目のエントリが直前バージョン
      targetVersion = history[1].version;
    }

    if (!targetVersion) {
      console.log(`ℹ️  比較対象の過去バージョンが見つかりません`);
      return ExitCode.SUCCESS;
    }
  }

  console.log(`🔍 ${relPath} の差分を表示します (v${targetVersion} vs Working Tree)`);
  console.log(SEPARATOR);

  let targetCommit;
  try {
    targetCommit = await findVersionCommit(
      ctx.git,
      relPath,
      targetVersion,
      versionPath,
    );
  } catch (err) {
    if (err instanceof DiffTargetNotFoundError) {
      printError(`ERROR: バージョン [${targetVersion}] のコミットが見つかりません`);
      try {
        const history = await getVersionHistory(ctx.git, relPath, versionPath);
        const versions = [
          ...new Set(
            history.map((c) => c.version).filter((v): v is string => v !== null),
          ),
        ];
        if (versions.length > 0) {
          console.error(`  💡 Git履歴に存在するバージョン: ${versions.join(", ")}`);
        }
      } catch {
        // ignore
      }
    } else {
      printError(`ERROR: ${err instanceof Error ? err.message : String(err)}`);
    }
    return ExitCode.ERROR;
  }

  // コンテキスト行数: --full は全体、--context=N は N 行、デフォルトは git と同じ 3 行
  const unifiedLines = options.full ? 99999 : (options.context ?? 3);

  try {
    // リネームされた場合は旧パスの blob と現在のファイルを比較する
    const oldPath = targetCommit.filePath ?? relPath;
    const diffArgs =
      oldPath !== relPath
        ? [`-U${unifiedLines}`, `${targetCommit.hash}:${oldPath}`, relPath]
        : [`-U${unifiedLines}`, targetCommit.hash, "--", relPath];
    const diffOutput = await ctx.git.diff(diffArgs);
    if (diffOutput) {
      console.log(diffOutput);
    } else {
      console.log(`  ℹ️  差分なし`);
    }
  } catch (err) {
    printError(
      `ERROR: diff の取得に失敗しました: ${err instanceof Error ? err.message : String(err)}`,
    );
    return ExitCode.ERROR;
  }

  return ExitCode.SUCCESS;
}
