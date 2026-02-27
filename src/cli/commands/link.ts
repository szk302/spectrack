import { existsSync } from "node:fs";
import { resolve, relative } from "node:path";
import type { Dependency } from "../../types/document.js";
import { ExitCode } from "../../output/exit-code.js";
import { printError, printTreeItems } from "../../output/formatter.js";
import { parseFile } from "../../frontmatter/parser.js";
import { updateFrontMatter, writeDocument } from "../../frontmatter/writer.js";
import { resolveVersion } from "../../version/version-resolver.js";
import type { CommandContext } from "../runner.js";

export type LinkOptions = {
  readonly deps: string;
  readonly dryRun?: boolean;
};

/**
 * `spectrack link <file> --deps=<path>[:<version>],...`
 *
 * ファイル間の依存関係を結ぶ。
 * - deps にはファイルパスを指定する（IDではなくパス）
 * - バージョン省略時は依存先の Working tree バージョンを自動取得
 * - path ヒントを自動更新する
 */
export async function runLink(
  filePath: string,
  options: LinkOptions,
  ctx: CommandContext,
): Promise<ExitCode> {
  if (!existsSync(filePath)) {
    printError(`ERROR: ファイル [${relative(ctx.cwd, filePath)}] が見つかりません`);
    return ExitCode.ERROR;
  }

  // --deps をパース: "path[:version],path[:version],..."
  const depSpecs = options.deps
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const newDeps: Dependency[] = [];

  for (const spec of depSpecs) {
    const colonIdx = spec.indexOf(":");
    let depFilePath: string;
    let explicitVersion: string | undefined;

    if (colonIdx !== -1) {
      depFilePath = spec.slice(0, colonIdx).trim();
      explicitVersion = spec.slice(colonIdx + 1).trim() || undefined;
    } else {
      depFilePath = spec;
    }

    const absDepPath = resolve(ctx.cwd, depFilePath);
    if (!existsSync(absDepPath)) {
      printError(`ERROR: 依存先ファイル [${depFilePath}] が見つかりません`);
      return ExitCode.ERROR;
    }

    let depDoc;
    try {
      depDoc = parseFile(absDepPath, ctx.cwd);
    } catch {
      printError(`ERROR: 依存先ファイル [${depFilePath}] のパースに失敗しました`);
      return ExitCode.ERROR;
    }

    const depId = depDoc.frontMatter.id;
    if (!depId) {
      printError(`ERROR: [${depFilePath}] に x-st-id が設定されていません`);
      return ExitCode.ERROR;
    }

    const version = explicitVersion ?? resolveVersion(depDoc) ?? "0.0.0";
    const depRelPath = relative(ctx.cwd, absDepPath);

    newDeps.push({ id: depId, path: depRelPath, version });
  }

  // ターゲットファイルをパース
  const parsed = parseFile(filePath, ctx.cwd);
  const relPath = relative(ctx.cwd, filePath);

  // フロントマターが未設定の場合はエラー（事前に init が必要）
  if (!parsed.frontMatter.id) {
    printError(
      `ERROR: [${relPath}] にフロントマターが設定されていません。先に spectrack init <file> を実行してください`,
    );
    return ExitCode.ERROR;
  }

  // 既存の依存関係にマージ（重複IDは上書き）
  const existingDeps = [...parsed.frontMatter.dependencies];
  for (const newDep of newDeps) {
    const existingIdx = existingDeps.findIndex((d) => d.id === newDep.id);
    if (existingIdx >= 0) {
      existingDeps[existingIdx] = newDep;
    } else {
      existingDeps.push(newDep);
    }
  }

  const updated = updateFrontMatter(parsed, { "x-st-dependencies": existingDeps });

  const id = updated.frontMatter.id ?? "(未設定)";

  if (options.dryRun) {
    console.log(`[DRY RUN] 🔗 依存関係をリンクします`);
    console.log(`  📄 ファイル: ${relPath}`);
    console.log(`  🆔 ID: ${id}`);
    console.log(`  📦 追加/更新する依存ドキュメント: ${newDeps.length} 個`);
    printTreeItems(
      newDeps.map((d) => `➕ ${d.id} (${d.path}: v${d.version})`),
      "    ",
    );
    return ExitCode.SUCCESS;
  }

  writeDocument(updated);

  console.log(`🔗 依存関係をリンクしました`);
  console.log(`  📄 ファイル: ${relPath}`);
  console.log(`  🆔 ID: ${id}`);
  console.log(`  📦 依存ドキュメント追加: ${newDeps.length} 個`);
  printTreeItems(
    newDeps.map((d) => `➕ ${d.id} (${d.path}: v${d.version})`),
    "    ",
  );

  return ExitCode.SUCCESS;
}
