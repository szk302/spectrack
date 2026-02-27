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

export type LogOptions = {
  readonly diff?: string;
};

/**
 * `spectrack log <file> [--diff=<version>]`
 *
 * 指定ドキュメントのバージョン変更履歴を表示する。
 * - `--diff=<version>` を指定すると、指定バージョンとの差分を表示する。
 *
 * このコマンドのみ Git コミット履歴を正として動作する。
 */
export async function runLog(
  filePath: string,
  options: LogOptions,
  ctx: CommandContext,
): Promise<ExitCode> {
  if (!existsSync(filePath)) {
    printError(`ERROR: ファイル [${filePath}] が見つかりません`);
    return ExitCode.ERROR;
  }

  const parsed = parseFile(filePath, ctx.cwd);
  const currentVersion = resolveVersion(parsed);
  const relativePath = relative(ctx.cwd, filePath);
  const versionPath = parsed.frontMatter.versionPath ?? "version";

  if (options.diff) {
    // --diff モード: 差分を表示
    console.log(`📝 現在のバージョン: ${currentVersion ?? "?"}`);
    console.log(`🔍 比較対象バージョン: ${options.diff}`);

    let targetCommit;
    try {
      targetCommit = await findVersionCommit(
        ctx.git,
        relativePath,
        options.diff,
        versionPath,
      );
    } catch (err) {
      printError(err instanceof Error ? err.message : String(err));
      if (err instanceof DiffTargetNotFoundError) {
        try {
          const history = await getVersionHistory(
            ctx.git,
            relativePath,
            versionPath,
          );
          const versions = [
            ...new Set(
              history.map((c) => c.version).filter((v): v is string => v !== null),
            ),
          ];
          if (versions.length > 0) {
            console.error(
              `  💡 Git履歴に存在するバージョン: ${versions.join(", ")}`,
            );
          }
        } catch {
          // ignore
        }
      }
      return ExitCode.ERROR;
    }

    console.log(`📦 対応するコミット: ${targetCommit.hash}`);
    console.log(`📖 差分を表示します...`);

    try {
      const diffOutput = await ctx.git.diff([
        `${targetCommit.hash}`,
        "--",
        relativePath,
      ]);
      console.log(diffOutput);
    } catch (err) {
      printError(
        `ERROR: diff の取得に失敗しました: ${err instanceof Error ? err.message : String(err)}`,
      );
      return ExitCode.ERROR;
    }
  } else {
    // 履歴表示モード
    console.log(SEPARATOR);
    console.log(`📋 [${parsed.frontMatter.id ?? relativePath}] バージョン履歴\n`);

    const history = await getVersionHistory(ctx.git, relativePath, versionPath);

    if (history.length === 0) {
      console.log(`  ℹ️  バージョン履歴が見つかりません`);
      return ExitCode.SUCCESS;
    }

    for (const commit of history) {
      const version = commit.version ?? "(不明)";
      const date = commit.date.slice(0, 10);
      console.log(`  📌 ${version}  (${date} @ ${commit.shortHash})`);
    }
  }

  return ExitCode.SUCCESS;
}
