import { existsSync } from "node:fs";
import { relative } from "node:path";
import { ExitCode } from "../../output/exit-code.js";
import { printError } from "../../output/formatter.js";
import { parseFile } from "../../frontmatter/parser.js";
import { resolveVersion } from "../../version/version-resolver.js";
import { findHistoricalDependentFiles } from "../../git/git-client.js";
import type { DependentsCommandContext } from "../runner.js";

/**
 * `spectrack dependents <file> [--all]`
 *
 * 指定したドキュメントに「依存している」ドキュメント（逆引き）を検索する。
 * --all 指定時は Git 全履歴から過去の依存も含めて検索する。
 */
export async function runDependents(
  filePath: string,
  opts: { all?: boolean },
  ctx: DependentsCommandContext,
): Promise<ExitCode> {
  if (!existsSync(filePath)) {
    printError(`ERROR: ファイル [${filePath}] が見つかりません`);
    return ExitCode.ERROR;
  }

  const parsed = parseFile(filePath, ctx.cwd);
  const targetId = parsed.frontMatter.id;

  if (!targetId) {
    printError(`ERROR: [${filePath}] に x-st-id が設定されていません`);
    return ExitCode.ERROR;
  }

  const relativePath = relative(ctx.cwd, filePath);

  if (opts.all) {
    console.log(
      `🔍 [${targetId}] ${relativePath} に依存した履歴を持つドキュメントを検索中...\n`,
    );
  } else {
    console.log(
      `🔍 [${targetId}] ${relativePath} に依存しているドキュメントを検索中...\n`,
    );
  }

  // 現在の依存元ドキュメントを取得
  const currentDependents = ctx.docs.filter((doc) =>
    doc.frontMatter.dependencies.some((dep) => dep.id === targetId),
  );

  if (!opts.all) {
    // 通常モード: Working Tree の依存のみ表示
    if (currentDependents.length === 0) {
      console.log(`  ℹ️  依存しているドキュメントは見つかりませんでした`);
      return ExitCode.SUCCESS;
    }

    for (const dep of currentDependents) {
      const depId = dep.frontMatter.id ?? "(不明)";
      const depRelPath = relative(ctx.cwd, dep.filePath);
      const depVersion = resolveVersion(dep) ?? "?";
      const refDep = dep.frontMatter.dependencies.find((d) => d.id === targetId);
      const refVersion = refDep?.version ?? "?";

      console.log(`  ✅ [${depId}] ${depRelPath} (${depVersion} @ Working tree)`);
      console.log(
        `      └─ depends on: [${targetId}] ${relativePath} (${refVersion})`,
      );
      console.log();
    }

    return ExitCode.SUCCESS;
  }

  // --all モード: Git が必要
  if (ctx.git === null) {
    printError(
      "ERROR: --all オプションには Git リポジトリが必要です。Git リポジトリが初期化されていないか、コミットが存在しません",
    );
    return ExitCode.ERROR;
  }

  // --all モード: Git 全履歴から過去の依存も含めて検索
  const currentDependentPaths = new Set(
    currentDependents.map((d) => relative(ctx.cwd, d.filePath)),
  );

  // 現在の依存元を「現在も依存中」として表示
  for (const dep of currentDependents) {
    const depId = dep.frontMatter.id ?? "(不明)";
    const depRelPath = relative(ctx.cwd, dep.filePath);
    console.log(`  ✅ [${depId}] ${depRelPath} (現在も依存中)`);
  }

  // Git 履歴から過去に依存していたファイルを検索
  const historicalFiles = await findHistoricalDependentFiles(ctx.git, targetId);

  const pastDependents = historicalFiles.filter(
    ({ filePath: fp }) => !currentDependentPaths.has(fp) && fp !== relativePath,
  );

  for (const { filePath: fp, commitHash } of pastDependents) {
    console.log(
      `  🕰️  ${fp} (過去に依存。コミット ${commitHash} で依存解除/削除)`,
    );
  }

  if (currentDependents.length === 0 && pastDependents.length === 0) {
    console.log(`  ℹ️  依存しているドキュメントは見つかりませんでした（履歴を含む）`);
  }

  return ExitCode.SUCCESS;
}
