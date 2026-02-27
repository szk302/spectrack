import { existsSync } from "node:fs";
import { resolve, relative } from "node:path";
import { ExitCode } from "../../output/exit-code.js";
import { printError, printTreeItems } from "../../output/formatter.js";
import { parseFile } from "../../frontmatter/parser.js";
import { updateFrontMatter, writeDocument } from "../../frontmatter/writer.js";
import type { CommandContext } from "../runner.js";

export type UnlinkOptions = {
  readonly deps: string;
  readonly dryRun?: boolean;
};

/**
 * `spectrack unlink <file> --deps=<path>,...`
 *
 * ファイル間の依存関係を解除する。
 * - deps にはファイルパスまたはIDを指定する
 */
export async function runUnlink(
  filePath: string,
  options: UnlinkOptions,
  ctx: CommandContext,
): Promise<ExitCode> {
  if (!existsSync(filePath)) {
    printError(`ERROR: ファイル [${relative(ctx.cwd, filePath)}] が見つかりません`);
    return ExitCode.ERROR;
  }

  const parsed = parseFile(filePath, ctx.cwd);
  const relPath = relative(ctx.cwd, filePath);

  // deps をパースして ID に変換
  const removeIds: string[] = [];
  const depSpecs = options.deps
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  for (const spec of depSpecs) {
    const absPath = resolve(ctx.cwd, spec);
    if (existsSync(absPath)) {
      // ファイルパスの場合 → ID を取得
      try {
        const depDoc = parseFile(absPath, ctx.cwd);
        const depId = depDoc.frontMatter.id;
        if (!depId) {
          printError(`ERROR: [${spec}] に x-st-id が設定されていません`);
          return ExitCode.ERROR;
        }
        removeIds.push(depId);
      } catch {
        printError(`ERROR: [${spec}] のパースに失敗しました`);
        return ExitCode.ERROR;
      }
    } else {
      // ID として扱う
      removeIds.push(spec);
    }
  }

  const currentDeps = [...parsed.frontMatter.dependencies];
  const removedDeps = currentDeps.filter((d) => removeIds.includes(d.id));
  const updatedDeps = currentDeps.filter((d) => !removeIds.includes(d.id));

  if (removedDeps.length === 0) {
    console.log(`ℹ️  削除対象の依存関係が見つかりません`);
    return ExitCode.SUCCESS;
  }

  const updated = updateFrontMatter(parsed, { "x-st-dependencies": updatedDeps });

  if (options.dryRun) {
    console.log(`[DRY RUN] 🔓 依存関係を解除します`);
    console.log(`  📄 ファイル: ${relPath}`);
    printTreeItems(
      removedDeps.map((d) => `➖ ${d.id}`),
      "  ",
    );
    return ExitCode.SUCCESS;
  }

  writeDocument(updated);

  console.log(`🔓 依存関係を解除しました`);
  console.log(`  📄 ファイル: ${relPath}`);
  printTreeItems(
    removedDeps.map((d) => `➖ ${d.id}`),
    "  ",
  );

  return ExitCode.SUCCESS;
}
