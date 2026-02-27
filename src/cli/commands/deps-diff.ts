import { existsSync } from "node:fs";
import { relative } from "node:path";
import { ExitCode } from "../../output/exit-code.js";
import { printError, SEPARATOR } from "../../output/formatter.js";
import { parseFile } from "../../frontmatter/parser.js";
import { resolveVersion } from "../../version/version-resolver.js";
import { resolveId } from "../../scanner/id-registry.js";
import {
  findVersionCommit,
} from "../../git/history-resolver.js";
import { DiffTargetNotFoundError } from "../../types/errors.js";
import type { CommandContext } from "../runner.js";

/**
 * `spectrack deps-diff <file>`
 *
 * 対象ドキュメントが依存しているすべてのドキュメントの差分を表示する。
 * - フロントマター内の「参照バージョン」になった時点のコミットを特定し、
 *   Working Tree との diff を出力する。
 * - 参照バージョンと現在バージョンが同じ場合はスキップする。
 *
 * このコマンドは Git 履歴を参照するため、Working Tree ファーストの例外に該当する。
 */
export async function runDepsDiff(
  filePath: string,
  ctx: CommandContext,
): Promise<ExitCode> {
  if (!existsSync(filePath)) {
    printError(
      `ERROR: ファイル [${relative(ctx.cwd, filePath)}] が見つかりません`,
    );
    return ExitCode.ERROR;
  }

  const parsed = parseFile(filePath, ctx.cwd);
  const relPath = relative(ctx.cwd, filePath);

  if (!parsed.frontMatter.id) {
    printError(`ERROR: [${relPath}] に x-st-id が設定されていません`);
    return ExitCode.ERROR;
  }

  const deps = parsed.frontMatter.dependencies;
  if (deps.length === 0) {
    console.log(
      `ℹ️  [${parsed.frontMatter.id}] ${relPath} には依存関係がありません`,
    );
    return ExitCode.SUCCESS;
  }

  console.log(`🔍 依存先ドキュメントの変更内容を表示します...\n`);

  let errorCount = 0;

  for (const dep of deps) {
    const entry = resolveId(ctx.idRegistry, dep.id);

    if (!entry) {
      printError(`ERROR: 依存先 [${dep.id}] が見つかりません`);
      errorCount++;
      continue;
    }

    if (!existsSync(entry.filePath)) {
      printError(
        `ERROR: 依存先ファイル [${entry.relativePath}] が見つかりません`,
      );
      errorCount++;
      continue;
    }

    let depDoc;
    try {
      depDoc = parseFile(entry.filePath, ctx.cwd);
    } catch {
      printError(
        `ERROR: 依存先ファイル [${entry.relativePath}] のパースに失敗しました`,
      );
      errorCount++;
      continue;
    }

    const currentVersion = resolveVersion(depDoc);
    const refVersion = dep.version;

    // 参照バージョン = 現在バージョン → スキップ
    if (currentVersion === refVersion) {
      continue;
    }

    const versionPath = depDoc.frontMatter.versionPath ?? "version";

    console.log(SEPARATOR);
    console.log(
      `📄 [${dep.id}] ${entry.relativePath} (参照: ${refVersion} → 現在: ${currentVersion ?? "?"})`,
    );

    let targetCommit;
    try {
      targetCommit = await findVersionCommit(
        ctx.git,
        entry.relativePath,
        refVersion,
        versionPath,
      );
    } catch (err) {
      if (err instanceof DiffTargetNotFoundError) {
        printError(
          `ERROR: 参照バージョン [${refVersion}] のコミットが見つかりません`,
        );
      } else {
        printError(
          `ERROR: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
      errorCount++;
      continue;
    }

    console.log(
      `📦 比較対象: ${targetCommit.shortHash} (v${refVersion}) vs Working Tree`,
    );
    console.log(SEPARATOR);

    try {
      const diffOutput = await ctx.git.diff([
        targetCommit.hash,
        "--",
        entry.relativePath,
      ]);
      if (diffOutput) {
        console.log(diffOutput);
      } else {
        console.log(`  ℹ️  差分なし`);
      }
    } catch (err) {
      printError(
        `ERROR: diff の取得に失敗しました: ${err instanceof Error ? err.message : String(err)}`,
      );
      errorCount++;
    }
  }

  return errorCount > 0 ? ExitCode.ERROR : ExitCode.SUCCESS;
}
