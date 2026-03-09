import { existsSync } from "node:fs";
import { resolve, relative } from "node:path";
import type { Dependency } from "../../types/document.js";
import { ExitCode } from "../../output/exit-code.js";
import { printError, printTreeItems } from "../../output/formatter.js";
import { parseFile } from "../../frontmatter/parser.js";
import { updateDependenciesAST, writeDocument } from "../../frontmatter/writer.js";
import { resolveVersion } from "../../version/version-resolver.js";
import { resolveId } from "../../scanner/id-registry.js";
import { estimateDeletedFilePath } from "../../git/file-tracker.js";
import type { CommandContext } from "../runner.js";

export type SyncOptions = {
  readonly only?: string;
  readonly dryRun?: boolean;
};

/**
 * `spectrack sync <file> [--only=<path_or_id>,...] [--dry-run]`
 *
 * 依存先ドキュメントが更新されていた場合、依存バージョンを
 * Working tree の最新バージョンで同期する。
 * path ヒントも同時に更新する。
 */
export async function runSync(
  filePath: string,
  options: SyncOptions,
  ctx: CommandContext,
): Promise<ExitCode> {
  const relPath = relative(ctx.cwd, filePath);

  if (!existsSync(filePath)) {
    printError(`ERROR: ファイル [${relPath}] が見つかりません`);
    return ExitCode.ERROR;
  }

  let parsed;
  try {
    parsed = parseFile(filePath, ctx.cwd);
  } catch {
    // F6-1: バイナリや不正なフロントマター
    printError(`ERROR: [${relPath}] フロントマターが読み込めません`);
    return ExitCode.ERROR;
  }

  // E4-1 / F6-1: 未初期化チェック
  if (!parsed.frontMatter.id) {
    printError(
      `ERROR: [${relPath}] 対象ファイルが初期化されていません（spectrack init を実行してください）`,
    );
    return ExitCode.ERROR;
  }

  // M5-3: 依存リスト形式チェック（文字列要素などの不正要素を検出）
  const rawDeps = parsed.frontMatter.raw["x-st-dependencies"];
  if (
    Array.isArray(rawDeps) &&
    rawDeps.some((d) => typeof d !== "object" || d === null)
  ) {
    printError(`ERROR: [${relPath}] 依存リストの形式が不正です`);
    return ExitCode.ERROR;
  }

  if (parsed.frontMatter.dependencies.length === 0) {
    console.log(`ℹ️  同期する依存先がありません`);
    return ExitCode.SUCCESS;
  }

  // --only フィルタを ID リストに変換
  let onlyIds: Set<string> | undefined;
  if (options.only) {
    onlyIds = new Set<string>();
    for (const spec of options.only
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)) {
      const absPath = resolve(ctx.cwd, spec);
      if (existsSync(absPath)) {
        try {
          const depDoc = parseFile(absPath, ctx.cwd);
          const id = depDoc.frontMatter.id;
          if (id) onlyIds.add(id);
        } catch {
          // ignore parse errors for filter resolution
        }
      } else {
        onlyIds.add(spec);
      }
    }
  }

  type SyncRecord = { id: string; oldVersion: string; newVersion: string };
  const syncedItems: SyncRecord[] = [];
  const updatedDeps: Dependency[] = [];
  let onlyMatchCount = 0;

  for (const dep of parsed.frontMatter.dependencies) {
    if (onlyIds && !onlyIds.has(dep.id)) {
      updatedDeps.push(dep);
      continue;
    }
    if (onlyIds) onlyMatchCount++;

    const entry = resolveId(ctx.idRegistry, dep.id);
    if (!entry) {
      // E4-2 / E4-3: Git 履歴から削除されたファイルパスを推定
      const estimatedPath = await estimateDeletedFilePath(ctx.git, dep.id);
      if (estimatedPath) {
        printError(
          `ERROR: 依存先 [${dep.id}] が見つかりません。ファイルが削除された可能性があります。（Git履歴の推定元パス: ${estimatedPath}）`,
        );
      } else {
        printError(
          `ERROR: 依存先 [${dep.id}] が見つかりません。Git履歴からもパスを推定できませんでした`,
        );
      }
      return ExitCode.ERROR;
    }

    let depDoc;
    try {
      depDoc = parseFile(entry.filePath, ctx.cwd);
    } catch {
      // F6-2: 依存先ファイルのパースエラー
      printError(`ERROR: 依存先 [${dep.id}] のファイルが読み込めません`);
      return ExitCode.ERROR;
    }

    const newVersion = resolveVersion(depDoc);
    if (newVersion === null) {
      // M5-2: 依存先バージョン情報なし
      printError(`ERROR: 依存先 [${dep.id}] のバージョン情報が見つかりません`);
      return ExitCode.ERROR;
    }

    const newPath = entry.relativePath;

    if (newVersion !== dep.version || newPath !== dep.path) {
      syncedItems.push({ id: dep.id, oldVersion: dep.version, newVersion });
    }
    updatedDeps.push({ id: dep.id, path: newPath, version: newVersion });
  }

  // O2-4: --only 指定が依存リストにマッチしなかった場合
  if (onlyIds && onlyMatchCount === 0) {
    console.log(`ℹ️  指定された依存関係は見つかりません`);
    return ExitCode.SUCCESS;
  }

  if (options.dryRun) {
    console.log(`[DRY RUN] 🔄 依存バージョンを同期します`);
    console.log(`  📄 ファイル: ${relPath}`);
    if (syncedItems.length > 0) {
      printTreeItems(
        syncedItems.map((d) => `${d.id}: ${d.oldVersion} → ${d.newVersion}`),
        "  ",
      );
    } else {
      console.log(`  ✅ すべての依存関係はすでに最新です`);
    }
    return ExitCode.SUCCESS;
  }

  // I3-1: 変更がない場合はファイルを書き換えない
  if (syncedItems.length === 0) {
    console.log(`🔄 依存バージョンの同期完了`);
    console.log(`  📄 ファイル: ${relPath}`);
    console.log(`  ✅ すべての依存関係はすでに最新です`);
    return ExitCode.SUCCESS;
  }

  const updated = updateDependenciesAST(parsed, updatedDeps);
  writeDocument(updated);

  console.log(`🔄 依存バージョンの同期完了`);
  console.log(`  📄 ファイル: ${relPath}`);
  console.log(`  ✅ 以下の依存ドキュメントを最新状態に更新しました:`);
  printTreeItems(
    syncedItems.map((d) => `${d.id}: ${d.oldVersion} → ${d.newVersion}`),
    "    ",
  );

  return ExitCode.SUCCESS;
}
