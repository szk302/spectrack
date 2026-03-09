import { existsSync } from "node:fs";
import { relative } from "node:path";
import { ExitCode } from "../../output/exit-code.js";
import { printError, printSeparator, formatDepStatus, TREE } from "../../output/formatter.js";
import { parseFile } from "../../frontmatter/parser.js";
import { checkDocDeps } from "../../dependency/dep-checker.js";
import { resolveVersion } from "../../version/version-resolver.js";
import {
  isFileModifiedInWorkingTree,
  getLatestCommitHash,
} from "../../git/git-client.js";
import type { CommandContext } from "../runner.js";

export type StatusOptions = {
  readonly strict?: boolean;
};

/**
 * `spectrack status [<file>] [--strict]`
 *
 * ドキュメントの依存先ツリーを表示し、依存先のバージョンが
 * 更新されていれば警告を出す。
 *
 * 依存元と依存先の両方を Working tree（未コミット状態）を正として比較。
 */
export async function runStatus(
  filePath: string | undefined,
  options: StatusOptions,
  ctx: CommandContext,
): Promise<ExitCode> {
  let exitCode: ExitCode = ExitCode.SUCCESS;

  // 対象ドキュメントを決定
  let targetDocs;
  if (filePath) {
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

    // 指定ファイル自体も対象に含める（自身の依存関係を表示）
    const selfDoc = ctx.docs.find((d) => d.frontMatter.id === targetId);
    if (selfDoc && selfDoc.frontMatter.dependencies.length > 0) {
      targetDocs = [selfDoc];
    }
  } else {
    targetDocs = ctx.docs.filter(
      (doc) => doc.frontMatter.dependencies.length > 0,
    );
  }

  for (const doc of targetDocs) {
    const result = await checkDocDeps(
      doc,
      ctx.idRegistry,
      ctx.git,
      ctx.cwd,
      options.strict ?? false,
    );

    const docRelPath = relative(ctx.cwd, doc.filePath);
    const docId = doc.frontMatter.id ?? "(不明)";
    const docVersion = resolveVersion(doc) ?? "?";

    // ドキュメント自体が Working tree で変更されているか確認
    const docIsWorkingTree = await isFileModifiedInWorkingTree(
      ctx.git,
      docRelPath,
    );
    const docHash = docIsWorkingTree
      ? null
      : await getLatestCommitHash(ctx.git, docRelPath);

    const versionLabel = docIsWorkingTree
      ? `${docVersion} @ Working tree`
      : docHash
        ? `${docVersion} @ ${docHash}`
        : docVersion;

    printSeparator();
    console.log(`📄 [${docId}] ${docRelPath} (${versionLabel}) の依存状況:`);

    for (let i = 0; i < result.statuses.length; i++) {
      const status = result.statuses[i]!;
      const isLast =
        i === result.statuses.length - 1 && result.errors.length === 0;
      const connector = isLast ? TREE.LAST : TREE.BRANCH;

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
        status.isWorkingTree,
      );
      console.log(`   ${connector} ${line}`);

      if (status.hasUpdate) {
        if (exitCode === ExitCode.SUCCESS) {
          exitCode = ExitCode.WARNING;
        }
      }
    }

    for (const warn of result.semverWarnings) {
      console.log(
        `WARNING: [${warn.file}] のバージョン [${warn.version}] は有効なセマンティックバージョンではありません`,
      );
      if (exitCode === ExitCode.SUCCESS) {
        exitCode = ExitCode.WARNING;
      }
    }

    for (let i = 0; i < result.errors.length; i++) {
      const { id, error } = result.errors[i]!;
      const isLast = i === result.errors.length - 1;
      const connector = isLast ? TREE.LAST : TREE.BRANCH;
      printError(`   ${connector} ❌ [${id}]: ${error.message}`);
      exitCode = ExitCode.ERROR;
    }
  }

  if (exitCode === ExitCode.SUCCESS && targetDocs.length > 0) {
    console.log(`✅ すべての依存関係は最新です`);
  } else if (targetDocs.length === 0) {
    console.log(`ℹ️  依存関係のあるドキュメントが見つかりません`);
  }

  return exitCode;
}
