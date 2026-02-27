import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { stringify } from "yaml";
import type { Config } from "../../types/config.js";
import { DEFAULT_CONFIG } from "../../types/config.js";
import { ExitCode } from "../../output/exit-code.js";
import { loadConfig, configExists } from "../../config/loader.js";
import { loadIgnore } from "../../scanner/ignore-parser.js";
import { scanFiles } from "../../scanner/file-scanner.js";
import { parseFile } from "../../frontmatter/parser.js";
import { writeDocument, addFrontMatter } from "../../frontmatter/writer.js";
import { buildContext } from "../../context/context-builder.js";
import { expandTemplate } from "../../frontmatter/template-engine.js";
import {
  SPECTRACK_CONFIG_FILE,
  SPECTRACKIGNORE_FILE,
} from "../../config/defaults.js";
import type { TargetExtension } from "../../config/defaults.js";
import { printSuccess, printError } from "../../output/formatter.js";

const INIT_CONFIG_TEMPLATE = `# spectrack 設定ファイル
frontMatterKeyPrefix: x-st-   # フロントマターキープレフィックス (default: x-st-)
documentRootPath: doc         # ドキュメントルートパス (default: doc)

# frontMatterTemplate:
#   md:
#     version: 0.0.0
#     x-st-version-path: version
#     x-st-id: "{{context.file.dir}}-{{nanoid}}"
#     x-st-dependencies: []
#   yml:
#     x-st-version-path: info.version
#     x-st-id: "{{context.file.dir}}-{{nanoid}}"
#     x-st-dependencies: []
`;

export type InitOptions = {
  readonly addFrontmatter: boolean;
  readonly dryRun?: boolean;
};

export async function runInit(
  options: InitOptions,
  cwd: string = process.cwd(),
): Promise<ExitCode> {
  let errorCount = 0;

  // 設定ファイルの作成または確認
  const configPath = join(cwd, SPECTRACK_CONFIG_FILE);
  if (!configExists(cwd)) {
    writeFileSync(configPath, INIT_CONFIG_TEMPLATE, "utf-8");
    console.log(
      `⚙️  設定ファイル: ${SPECTRACK_CONFIG_FILE} を作成しました`,
    );
    console.log(
      `📝 テンプレート設定をコメント状態で記載しました。必要に応じて編集してください。`,
    );
  }

  // .spectrackignore がない場合は空ファイル作成
  const ignorePath = join(cwd, SPECTRACKIGNORE_FILE);
  if (!existsSync(ignorePath)) {
    writeFileSync(ignorePath, "# spectrack ignore file\n", "utf-8");
  }

  if (!options.addFrontmatter) {
    return ExitCode.SUCCESS;
  }

  // 設定を読み込む
  const config = loadConfig(cwd, false);

  // ファイルスキャン
  const documentRootPath = join(cwd, config.documentRootPath);
  const ig = loadIgnore(cwd);
  const filePaths = scanFiles(documentRootPath, ig, cwd);

  let addedCount = 0;
  let skippedCount = 0;

  for (const filePath of filePaths) {
    try {
      const parsed = parseFile(filePath, cwd);

      // 既に x-st-id が存在する場合はスキップ
      if (parsed.frontMatter.id) {
        skippedCount++;
        continue;
      }

      const ext = parsed.ext as TargetExtension;
      const template = config.frontMatterTemplate[ext] ?? config.frontMatterTemplate.md ?? DEFAULT_CONFIG.frontMatterTemplate.md!;

      // コンテキストを構築してテンプレートを展開
      const ctx = buildContext({
        config,
        doc: parsed,
        commandName: "init",
        cwd,
      });

      // テンプレートの各値を展開
      const initialFields: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(template)) {
        if (typeof value === "string") {
          initialFields[key] = expandTemplate(value, ctx);
        } else {
          initialFields[key] = value;
        }
      }

      const updated = addFrontMatter(parsed, initialFields);
      if (!options.dryRun) {
        writeDocument(updated);
      }
      addedCount++;
    } catch (err) {
      printError(
        `❌ ${filePath}: ${err instanceof Error ? err.message : String(err)}`,
      );
      errorCount++;
    }
  }

  console.log(`\n✅ 初期化完了`);
  console.log(`  📄 初期化対象ファイル数: ${filePaths.length} 個`);
  console.log(`  ✨ メタデータ追加: ${addedCount} 個`);
  console.log(`  ⏭️  スキップ（既に存在）: ${skippedCount} 個`);
  console.log(`  ❌ エラー: ${errorCount} 個`);

  return errorCount > 0 ? ExitCode.ERROR : ExitCode.SUCCESS;
}
