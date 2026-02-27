import { existsSync } from "node:fs";
import { relative } from "node:path";
import type { Dependency } from "../../types/document.js";
import { ExitCode } from "../../output/exit-code.js";
import { printSuccess, printError, printTreeItems } from "../../output/formatter.js";
import { parseFile } from "../../frontmatter/parser.js";
import { writeDocument, addFrontMatter, updateFrontMatter } from "../../frontmatter/writer.js";
import { buildContext } from "../../context/context-builder.js";
import { expandTemplate } from "../../frontmatter/template-engine.js";
import { resolveVersion } from "../../version/version-resolver.js";
import type { CommandContext } from "../runner.js";
import { resolveId } from "../../scanner/id-registry.js";
import type { TargetExtension } from "../../config/defaults.js";
import { DEFAULT_CONFIG } from "../../types/config.js";
import { FileNotFoundError, VersionNotFoundError } from "../../types/errors.js";

export type AddOptions = {
  readonly deps?: string;
};

/**
 * 依存指定文字列をパースして Dependency 配列に変換する
 * 形式: "id:version,id:version,..."
 */
export function parseDepsOption(deps: string): Dependency[] {
  return deps.split(",").map((pair) => {
    const colonIdx = pair.indexOf(":");
    if (colonIdx === -1) {
      throw new Error(`依存指定の形式が不正です: ${pair} (正しい形式: id:version)`);
    }
    return {
      id: pair.slice(0, colonIdx).trim(),
      version: pair.slice(colonIdx + 1).trim(),
    };
  });
}

export async function runAdd(
  filePath: string,
  options: AddOptions,
  ctx: CommandContext,
): Promise<ExitCode> {
  if (!existsSync(filePath)) {
    const relativePath = relative(ctx.cwd, filePath);
    printError(new FileNotFoundError(relativePath).message);
    return ExitCode.ERROR;
  }

  // 依存指定をパース・検証
  let deps: Dependency[] = [];
  if (options.deps) {
    try {
      deps = parseDepsOption(options.deps);
    } catch (err) {
      printError(err instanceof Error ? err.message : String(err));
      return ExitCode.ERROR;
    }

    // 依存先の存在確認（前方参照不可）
    for (const dep of deps) {
      const entry = resolveId(ctx.idRegistry, dep.id);
      if (!entry) {
        printError(`ERROR: ID [${dep.id}] が見つかりません`);
        return ExitCode.ERROR;
      }
    }
  }

  // ファイルをパース
  const parsed = parseFile(filePath, ctx.cwd);
  const ext = parsed.ext as TargetExtension;
  const template =
    ctx.config.frontMatterTemplate[ext] ??
    ctx.config.frontMatterTemplate.md ??
    DEFAULT_CONFIG.frontMatterTemplate.md!;

  // コンテキストを構築
  const context = buildContext({
    config: ctx.config,
    doc: parsed,
    commandName: "add",
    args: { file: relative(ctx.cwd, filePath) },
    options: { deps: options.deps, depsStructured: deps },
    cwd: ctx.cwd,
  });

  // テンプレートを展開してフロントマターを生成
  const initialFields: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(template)) {
    if (typeof value === "string") {
      initialFields[key] = expandTemplate(value, context);
    } else {
      initialFields[key] = value;
    }
  }

  // 依存関係を設定
  if (deps.length > 0) {
    initialFields["x-st-dependencies"] = deps;
  }

  // フロントマターを追加/更新
  let updated;
  if (!parsed.frontMatter.id) {
    updated = addFrontMatter(parsed, initialFields);
  } else {
    // 既に x-st-id がある場合は依存関係のみ更新
    updated = updateFrontMatter(parsed, {
      "x-st-dependencies": deps,
    });
  }

  writeDocument(updated);

  // 出力
  const id = updated.frontMatter.id ?? "(未設定)";
  const version = resolveVersion(updated) ?? "0.0.0";
  const relativePath = relative(ctx.cwd, filePath);

  console.log(`✅ ドキュメント追加完了`);
  console.log(`  📄 ファイル: ${relativePath}`);
  console.log(`  🆔 ID: ${id}`);
  console.log(`  📌 バージョン: ${version}`);

  if (deps.length > 0) {
    console.log(`  📦 依存ドキュメント: ${deps.length} 個`);
    const depItems = deps.map((d) => `${d.id} (v${d.version})`);
    printTreeItems(depItems, "    ");
  }

  return ExitCode.SUCCESS;
}
