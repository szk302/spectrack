import { existsSync } from "node:fs";
import { relative } from "node:path";
import { ExitCode } from "../../output/exit-code.js";
import { printError } from "../../output/formatter.js";
import { parseFile } from "../../frontmatter/parser.js";
import { resolveVersion } from "../../version/version-resolver.js";
import { findVersionCommit, getVersionHistory } from "../../git/history-resolver.js";
import { DiffTargetNotFoundError } from "../../types/errors.js";
import type { CommandContext } from "../runner.js";

export type DiffOptions = {
  readonly version: string;
};

export async function runDiff(
  filePath: string,
  options: DiffOptions,
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

  console.log(`📝 現在のバージョン: ${currentVersion ?? "?"}`);
  console.log(`🔍 比較対象バージョン: ${options.version}`);

  // 対象バージョンのコミットを特定
  let targetCommit;
  try {
    targetCommit = await findVersionCommit(
      ctx.git,
      relativePath,
      options.version,
      versionPath,
    );
  } catch (err) {
    printError(err instanceof Error ? err.message : String(err));
    if (err instanceof DiffTargetNotFoundError) {
      try {
        const history = await getVersionHistory(ctx.git, relativePath, versionPath);
        const versions = [
          ...new Set(history.map((c) => c.version).filter((v): v is string => v !== null)),
        ];
        if (versions.length > 0) {
          console.error(`  💡 Git履歴に存在するバージョン: ${versions.join(", ")}`);
        }
      } catch {
        // ignore
      }
    }
    return ExitCode.ERROR;
  }

  console.log(`📦 対応するコミット: ${targetCommit.hash}`);
  console.log(`📖 差分を表示します...`);

  // git diff を実行
  try {
    const diffOutput = await ctx.git.diff([
      `${targetCommit.hash}`,
      "--",
      relativePath,
    ]);
    console.log(diffOutput);
  } catch (err) {
    printError(`ERROR: diff の取得に失敗しました: ${err instanceof Error ? err.message : String(err)}`);
    return ExitCode.ERROR;
  }

  return ExitCode.SUCCESS;
}
