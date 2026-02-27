import { existsSync } from "node:fs";
import { relative } from "node:path";
import { ExitCode } from "../../output/exit-code.js";
import { printError } from "../../output/formatter.js";
import { parseFile } from "../../frontmatter/parser.js";
import { resolveVersion } from "../../version/version-resolver.js";
import type { CommandContext } from "../runner.js";
import { resolveId } from "../../scanner/id-registry.js";

export async function runFindDependents(
  filePath: string,
  ctx: CommandContext,
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
  console.log(
    `🔍 [${targetId}] ${relativePath} に依存しているドキュメントを検索中...\n`,
  );

  const dependents = ctx.docs.filter((doc) =>
    doc.frontMatter.dependencies.some((dep) => dep.id === targetId),
  );

  if (dependents.length === 0) {
    console.log(`  ℹ️  依存しているドキュメントは見つかりませんでした`);
    return ExitCode.SUCCESS;
  }

  for (const dep of dependents) {
    const depId = dep.frontMatter.id ?? "(不明)";
    const depRelPath = relative(ctx.cwd, dep.filePath);
    const depVersion = dep.currentVersion ?? "?";

    const refDep = dep.frontMatter.dependencies.find(
      (d) => d.id === targetId,
    );
    const refVersion = refDep?.version ?? "?";

    console.log(`  ✅ [${depId}] ${depRelPath} (${depVersion})`);
    console.log(
      `      └─ depends on: [${targetId}] ${relativePath} (${refVersion})`,
    );
    console.log();
  }

  return ExitCode.SUCCESS;
}
