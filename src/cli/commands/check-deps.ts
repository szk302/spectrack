import { existsSync } from "node:fs";
import { relative } from "node:path";
import { ExitCode } from "../../output/exit-code.js";
import { printError, printSeparator, formatDepStatus, TREE } from "../../output/formatter.js";
import { parseFile } from "../../frontmatter/parser.js";
import { checkDocDeps } from "../../dependency/dep-checker.js";
import { resolveVersion } from "../../version/version-resolver.js";
import type { CommandContext } from "../runner.js";

export type CheckDepsOptions = {
  readonly strict?: boolean;
};

export async function runCheckDeps(
  filePath: string | undefined,
  options: CheckDepsOptions,
  ctx: CommandContext,
): Promise<ExitCode> {
  let exitCode: ExitCode = ExitCode.SUCCESS;

  // 対象ドキュメントを決定
  let targetDocs;
  if (filePath) {
    // 指定ファイルに依存しているドキュメントをすべて検索
    if (!existsSync(filePath)) {
      printError(`ERROR: ファイル [${filePath}] が見つかりません`);
      return ExitCode.ERROR;
    }

    const targetParsed = parseFile(filePath, ctx.cwd);
    const targetId = targetParsed.frontMatter.id;

    if (!targetId) {
      printError(`ERROR: [${filePath}] に x-st-id が設定されていません`);
      return ExitCode.ERROR;
    }

    // 指定ファイルを依存先とするドキュメントをフィルタ
    targetDocs = ctx.docs.filter((doc) =>
      doc.frontMatter.dependencies.some((dep) => dep.id === targetId),
    );
  } else {
    // 全ドキュメント
    targetDocs = ctx.docs.filter(
      (doc) => doc.frontMatter.dependencies.length > 0,
    );
  }

  for (const doc of targetDocs) {
    const result = await checkDocDeps(
      doc,
      ctx.idRegistry,
      ctx.git,
      options.strict ?? false,
    );

    if (result.errors.length > 0 || result.statuses.some((s) => s.hasUpdate)) {
      const docRelPath = relative(ctx.cwd, doc.filePath);
      const docId = doc.frontMatter.id ?? "(不明)";

      printSeparator();
      console.log(`📄 [${docId}] ${docRelPath} の依存先:`);

      for (const status of result.statuses) {
        const depRelPath = (() => {
          const entry = ctx.idRegistry.get(status.dependency.id);
          return entry ? entry.relativePath : status.dependency.id;
        })();

        const line = formatDepStatus(
          status.dependency.id,
          depRelPath,
          status.dependency.version,
          status.currentVersion,
          status.commitHash,
          status.hasUpdate,
        );
        console.log(`   ${TREE.LAST} ${line}`);

        if (status.hasUpdate) {
          if (exitCode === ExitCode.SUCCESS) {
            exitCode = ExitCode.WARNING;
          }
        }
      }

      for (const { id, error } of result.errors) {
        printError(`   ${TREE.LAST} ❌ [${id}]: ${error.message}`);
        exitCode = ExitCode.ERROR;
      }
    }
  }

  if (exitCode === ExitCode.SUCCESS && targetDocs.length > 0) {
    console.log(`✅ すべての依存関係は最新です`);
  } else if (targetDocs.length === 0) {
    console.log(`ℹ️  依存関係のあるドキュメントが見つかりません`);
  }

  return exitCode;
}
