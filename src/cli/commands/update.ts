import { existsSync } from "node:fs";
import { relative } from "node:path";
import type { Dependency } from "../../types/document.js";
import { ExitCode } from "../../output/exit-code.js";
import { printError, printTreeItems } from "../../output/formatter.js";
import { parseFile } from "../../frontmatter/parser.js";
import { writeDocument, updateFrontMatter } from "../../frontmatter/writer.js";
import { resolveVersion } from "../../version/version-resolver.js";
import { FileNotFoundError, VersionNotFoundError } from "../../types/errors.js";
import type { CommandContext } from "../runner.js";
import { resolveId } from "../../scanner/id-registry.js";
import { getCommittedVersion } from "../../git/history-resolver.js";
import { parseDepsOption } from "./add.js";

export type UpdateOptions = {
  readonly version?: string;
  readonly addDeps?: string;
  readonly removeDeps?: string;
  readonly upgradeDeps?: boolean;
};

export async function runUpdate(
  filePath: string,
  options: UpdateOptions,
  ctx: CommandContext,
): Promise<ExitCode> {
  if (!existsSync(filePath)) {
    const relativePath = relative(ctx.cwd, filePath);
    printError(new FileNotFoundError(relativePath).message);
    return ExitCode.ERROR;
  }

  const parsed = parseFile(filePath, ctx.cwd);
  const relativePath = relative(ctx.cwd, filePath);

  const prevVersion = resolveVersion(parsed);
  const updates: Record<string, unknown> = {};
  let newVersion: string | undefined;

  // バージョン更新
  if (options.version) {
    const versionPath = parsed.frontMatter.versionPath ?? "version";
    // dotpath で更新するため、シンプルなケースのみ対応
    if (versionPath.includes(".")) {
      // ネストされたパスは parsed の raw を更新
      const pathParts = versionPath.split(".");
      let current = { ...parsed.frontMatter.raw } as Record<string, unknown>;
      const updateNested = (
        obj: Record<string, unknown>,
        parts: string[],
        value: string,
      ): Record<string, unknown> => {
        if (parts.length === 1) {
          return { ...obj, [parts[0]!]: value };
        }
        const [head, ...rest] = parts;
        return {
          ...obj,
          [head!]: updateNested(
            (obj[head!] as Record<string, unknown>) ?? {},
            rest,
            value,
          ),
        };
      };
      current = updateNested(current, pathParts, options.version);
      // 更新されたフィールドを updates にマージ
      const topKey = pathParts[0]!;
      updates[topKey] = current[topKey];
    } else {
      updates[versionPath] = options.version;
    }
    newVersion = options.version;
  }

  // 依存関係の追加/更新
  if (options.addDeps) {
    let newDeps: Dependency[];
    try {
      const rawDeps = options.addDeps.split(",").map((pair) => {
        const colonIdx = pair.indexOf(":");
        if (colonIdx === -1) {
          return { id: pair.trim(), version: "auto" };
        }
        return {
          id: pair.slice(0, colonIdx).trim(),
          version: pair.slice(colonIdx + 1).trim(),
        };
      });

      newDeps = [];
      for (const dep of rawDeps) {
        const entry = resolveId(ctx.idRegistry, dep.id);
        if (!entry) {
          printError(`ERROR: ID [${dep.id}] が見つかりません`);
          return ExitCode.ERROR;
        }

        let version = dep.version;
        if (version === "auto") {
          // 最新コミット版のバージョンを自動取得
          const depDoc = ctx.docs.find((d) => d.frontMatter.id === dep.id);
          const vPath = depDoc?.frontMatter.versionPath ?? "version";
          const { version: committedVer } = await getCommittedVersion(
            ctx.git,
            entry.relativePath,
            vPath,
          );
          if (!committedVer) {
            printError(
              `ERROR: ID [${dep.id}] のコミット済みバージョンを取得できませんでした`,
            );
            return ExitCode.ERROR;
          }
          version = committedVer;
        }

        newDeps.push({ id: dep.id, version });
      }
    } catch (err) {
      printError(err instanceof Error ? err.message : String(err));
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
    updates["x-st-dependencies"] = existingDeps;
  }

  // 依存関係の削除
  if (options.removeDeps) {
    const removeIds = options.removeDeps.split(",").map((s) => s.trim());
    const currentDeps = Array.isArray(updates["x-st-dependencies"])
      ? (updates["x-st-dependencies"] as Dependency[])
      : [...parsed.frontMatter.dependencies];
    updates["x-st-dependencies"] = currentDeps.filter(
      (d) => !removeIds.includes(d.id),
    );
  }

  // 全依存関係を最新バージョンにアップグレード
  if (options.upgradeDeps) {
    const currentDeps = Array.isArray(updates["x-st-dependencies"])
      ? (updates["x-st-dependencies"] as Dependency[])
      : [...parsed.frontMatter.dependencies];

    const upgradedDeps: Dependency[] = [];
    for (const dep of currentDeps) {
      const entry = resolveId(ctx.idRegistry, dep.id);
      if (!entry) {
        upgradedDeps.push(dep);
        continue;
      }
      const depDoc = ctx.docs.find((d) => d.frontMatter.id === dep.id);
      const vPath = depDoc?.frontMatter.versionPath ?? "version";
      const { version: latestVersion } = await getCommittedVersion(
        ctx.git,
        entry.relativePath,
        vPath,
      );
      upgradedDeps.push({ id: dep.id, version: latestVersion ?? dep.version });
    }
    updates["x-st-dependencies"] = upgradedDeps;
  }

  const updated = updateFrontMatter(parsed, updates);
  writeDocument(updated);

  // 出力
  const id = updated.frontMatter.id ?? "(未設定)";
  console.log(`✅ ドキュメント更新完了`);
  console.log(`  📄 ファイル: ${relativePath}`);
  console.log(`  🆔 ID: ${id}`);
  console.log(`  📝 更新内容:`);

  const updateItems: string[] = [];
  if (newVersion && prevVersion) {
    updateItems.push(`📌 バージョン: ${prevVersion} → ${newVersion}`);
  } else if (newVersion) {
    updateItems.push(`📌 バージョン: ${newVersion}`);
  }

  if (options.addDeps) {
    const addedItems = options.addDeps
      .split(",")
      .map((s) => s.trim());
    updateItems.push(`➕ 依存ドキュメント追加/更新: ${addedItems.length} 個`);
  }

  if (options.removeDeps) {
    const removedItems = options.removeDeps
      .split(",")
      .map((s) => s.trim());
    updateItems.push(`➖ 依存ドキュメント削除: ${removedItems.length} 個`);
  }

  if (options.upgradeDeps) {
    updateItems.push(`⬆️  依存ドキュメントバージョンを最新に更新`);
  }

  printTreeItems(updateItems, "    ");

  return ExitCode.SUCCESS;
}
