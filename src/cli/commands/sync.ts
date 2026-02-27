import { existsSync } from "node:fs";
import { resolve, relative } from "node:path";
import type { Dependency } from "../../types/document.js";
import { ExitCode } from "../../output/exit-code.js";
import { printError, printTreeItems } from "../../output/formatter.js";
import { parseFile } from "../../frontmatter/parser.js";
import { updateFrontMatter, writeDocument } from "../../frontmatter/writer.js";
import { resolveVersion } from "../../version/version-resolver.js";
import { resolveId } from "../../scanner/id-registry.js";
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
  if (!existsSync(filePath)) {
    printError(`ERROR: ファイル [${relative(ctx.cwd, filePath)}] が見つかりません`);
    return ExitCode.ERROR;
  }

  const parsed = parseFile(filePath, ctx.cwd);
  const relPath = relative(ctx.cwd, filePath);

  if (parsed.frontMatter.dependencies.length === 0) {
    console.log(`ℹ️  依存関係がありません`);
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

  for (const dep of parsed.frontMatter.dependencies) {
    if (onlyIds && !onlyIds.has(dep.id)) {
      updatedDeps.push(dep);
      continue;
    }

    const entry = resolveId(ctx.idRegistry, dep.id);
    if (!entry) {
      updatedDeps.push(dep);
      continue;
    }

    let depDoc;
    try {
      depDoc = parseFile(entry.filePath, ctx.cwd);
    } catch {
      updatedDeps.push(dep);
      continue;
    }

    const newVersion = resolveVersion(depDoc) ?? dep.version;
    const newPath = entry.relativePath;

    if (newVersion !== dep.version || newPath !== dep.path) {
      syncedItems.push({ id: dep.id, oldVersion: dep.version, newVersion });
    }
    updatedDeps.push({ id: dep.id, path: newPath, version: newVersion });
  }

  const updated = updateFrontMatter(parsed, { "x-st-dependencies": updatedDeps });

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

  writeDocument(updated);

  console.log(`🔄 依存バージョンの同期完了`);
  console.log(`  📄 ファイル: ${relPath}`);
  if (syncedItems.length > 0) {
    console.log(`  ✅ 以下の依存ドキュメントを最新状態に更新しました:`);
    printTreeItems(
      syncedItems.map((d) => `${d.id}: ${d.oldVersion} → ${d.newVersion}`),
      "    ",
    );
  } else {
    console.log(`  ✅ すべての依存関係はすでに最新です`);
  }

  return ExitCode.SUCCESS;
}
