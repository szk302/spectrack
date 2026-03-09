import { existsSync } from "node:fs";
import { resolve, relative } from "node:path";
import type { Dependency } from "../../types/document.js";
import { ExitCode } from "../../output/exit-code.js";
import { printError, printTreeItems } from "../../output/formatter.js";
import { parseFile } from "../../frontmatter/parser.js";
import { updateFrontMatter, writeDocument } from "../../frontmatter/writer.js";
import { resolveVersion } from "../../version/version-resolver.js";
import { TARGET_EXTENSIONS } from "../../config/defaults.js";
import type { CommandContext } from "../runner.js";

function isSupportedExt(filePath: string): boolean {
  const dot = filePath.lastIndexOf(".");
  if (dot === -1) return false;
  const ext = filePath.slice(dot + 1).toLowerCase();
  return (TARGET_EXTENSIONS as readonly string[]).includes(ext);
}

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

  // 対象ファイルの拡張子チェック
  if (!isSupportedExt(filePath)) {
    printError(
      `ERROR: ファイル [${relative(ctx.cwd, filePath)}] はサポートされていない形式です（対応: md, yml, yaml）`,
    );
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

    // 依存先ファイルの拡張子チェック
    if (!isSupportedExt(depFilePath)) {
      printError(
        `ERROR: 依存先ファイル [${depFilePath}] はサポートされていない形式です（対応: md, yml, yaml）`,
      );
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

    let version: string;
    if (explicitVersion) {
      version = explicitVersion;
    } else if (depDoc.frontMatter.versionPath) {
      const resolved = resolveVersion(depDoc);
      if (!resolved) {
        printError(
          `ERROR: [${depFilePath}] のバージョン情報 [${depDoc.frontMatter.versionPath}] が見つかりません`,
        );
        return ExitCode.ERROR;
      }
      version = resolved;
    } else {
      version = "0.0.0";
    }
    const depRelPath = relative(ctx.cwd, absDepPath);

    newDeps.push({ id: depId, path: depRelPath, version });
  }

  // ターゲットファイルをパース
  let parsed;
  const relPath = relative(ctx.cwd, filePath);
  try {
    parsed = parseFile(filePath, ctx.cwd);
  } catch {
    printError(`ERROR: ファイル [${relPath}] のパースに失敗しました`);
    return ExitCode.ERROR;
  }

  // フロントマターが未設定の場合はエラー（事前に init が必要）
  if (!parsed.frontMatter.id) {
    printError(
      `ERROR: [${relPath}] にフロントマターが設定されていません。先に spectrack init <file> を実行してください`,
    );
    return ExitCode.ERROR;
  }

  // x-st-dependencies の型チェック（配列以外はエラー）
  const rawDepsValue = parsed.frontMatter.raw["x-st-dependencies"];
  if (rawDepsValue !== undefined && rawDepsValue !== null && !Array.isArray(rawDepsValue)) {
    printError(
      `ERROR: [${relPath}] の x-st-dependencies フィールドの型が不正です（配列が必要）`,
    );
    return ExitCode.ERROR;
  }

  // 自己参照チェック
  const selfRef = newDeps.find((d) => d.id === parsed.frontMatter.id);
  if (selfRef) {
    printError(`ERROR: 自分自身に依存することはできません`);
    return ExitCode.ERROR;
  }

  // 既存の依存関係にマージ（重複IDは上書き）—イミュータブルパターン
  const existingDeps = parsed.frontMatter.dependencies;
  const merged = existingDeps.map(
    (d) => newDeps.find((n) => n.id === d.id) ?? d,
  );
  const added = newDeps.filter(
    (n) => !existingDeps.some((d) => d.id === n.id),
  );
  const mergedDeps = [...merged, ...added];

  // 変更なし検出：新規追加もなく、バージョン変更もない場合はスキップ
  const hasVersionChange = existingDeps.some((e) => {
    const n = newDeps.find((n) => n.id === e.id);
    return n && n.version !== e.version;
  });
  if (added.length === 0 && !hasVersionChange) {
    console.log(`ℹ️  すでにリンクされています（変更なし）`);
    return ExitCode.SUCCESS;
  }

  const updated = updateFrontMatter(parsed, { "x-st-dependencies": mergedDeps });

  const id = updated.frontMatter.id ?? "(未設定)";

  // 実際に追加・更新される依存のみ（既存と同バージョンのものは除外）
  const effectiveDeps = [
    ...added,
    ...merged.filter((d) => {
      const e = existingDeps.find((e) => e.id === d.id);
      return e && e.version !== d.version;
    }),
  ];

  if (options.dryRun) {
    console.log(`[DRY RUN] 🔗 依存関係をリンクします`);
    console.log(`  📄 ファイル: ${relPath}`);
    console.log(`  🆔 ID: ${id}`);
    console.log(`  📦 追加/更新する依存ドキュメント: ${effectiveDeps.length} 個`);
    printTreeItems(
      effectiveDeps.map((d) => `➕ ${d.id} (${d.path}: v${d.version})`),
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
