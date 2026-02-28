import { createInterface } from "node:readline/promises";
import { existsSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
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
import { printError } from "../../output/formatter.js";

const INIT_CONFIG_TEMPLATE = `# spectrack 設定ファイル
frontMatterKeyPrefix: x-st-   # フロントマターキープレフィックス (default: x-st-)

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

const DEFAULT_SPECTRACKIGNORE_CONTENT = `# 自動生成されたデフォルトの除外設定
node_modules/
.git/
.github/
.vscode/
dist/
build/
src/
README.md
CHANGELOG.md
docker-compose*.yml
.*.yml
.*.yaml
`;

export type InitOptions = {
  /** 初期化するファイルの絶対パス一覧（指定がなければ引数なしモード） */
  readonly files?: readonly string[];
  /** 全対象ファイルを一括初期化する */
  readonly all?: boolean;
  readonly dryRun?: boolean;
  /** --all 時の確認プロンプトをスキップする */
  readonly yes?: boolean;
};

async function promptConfirmation(count: number): Promise<boolean> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await rl.question(
      `⚠️  ${count} 個のファイルにメタデータを追加します。よろしいですか？ [y/N]: `,
    );
    return answer.trim().toLowerCase() === "y";
  } finally {
    rl.close();
  }
}

export async function runInit(
  options: InitOptions,
  cwd: string = process.cwd(),
  confirmFn?: (count: number) => Promise<boolean>,
): Promise<ExitCode> {
  // 設定ファイルの作成（--dry-run 時は書き込みをスキップ）
  const configPath = join(cwd, SPECTRACK_CONFIG_FILE);
  let configWillBeCreated = false;
  if (!configExists(cwd)) {
    configWillBeCreated = true;
    if (!options.dryRun) {
      writeFileSync(configPath, INIT_CONFIG_TEMPLATE, "utf-8");
      console.log(
        `⚙️  設定ファイル (${SPECTRACK_CONFIG_FILE}, ${SPECTRACKIGNORE_FILE}) を作成しました`,
      );
    } else {
      console.log(
        `[DRY RUN] ⚙️  設定ファイル: ${SPECTRACK_CONFIG_FILE} を作成します`,
      );
    }
  }

  // .spectrackignore がない場合は作成（--dry-run 時はスキップ）
  const ignorePath = join(cwd, SPECTRACKIGNORE_FILE);
  if (!existsSync(ignorePath) && !options.dryRun) {
    writeFileSync(ignorePath, DEFAULT_SPECTRACKIGNORE_CONTENT, "utf-8");
  }

  // 引数なし・--all なし → 設定ファイルのみ確認して終了
  if ((!options.files || options.files.length === 0) && !options.all) {
    if (!configWillBeCreated) {
      console.log(`✅ ${SPECTRACK_CONFIG_FILE} は既に存在します`);
    }
    return ExitCode.SUCCESS;
  }

  // 設定を読み込む（--dry-run でファイルが未作成でも loadConfig は default を返す）
  const config = loadConfig(cwd, false);

  // 対象ファイルの決定
  let filePaths: readonly string[];
  if (options.files && options.files.length > 0) {
    // ファイル指定モード: 確認プロンプトなしで処理
    filePaths = options.files;
  } else {
    // --all モード: プロジェクトルート全体をスキャン
    const ig = loadIgnore(cwd);
    const allPaths = scanFiles(cwd, ig, cwd);

    // 初期化が必要なファイルをカウントして確認プロンプトを表示
    const candidatesNeedingInit = allPaths.filter((fp) => {
      if (!existsSync(fp)) return false;
      try {
        const parsed = parseFile(fp, cwd);
        return !parsed.frontMatter.id;
      } catch {
        return false;
      }
    });

    if (
      candidatesNeedingInit.length > 0 &&
      !options.dryRun &&
      !options.yes
    ) {
      const confirm = confirmFn ?? promptConfirmation;
      const confirmed = await confirm(candidatesNeedingInit.length);
      if (!confirmed) {
        console.log("キャンセルしました");
        return ExitCode.SUCCESS;
      }
    }

    filePaths = allPaths;
  }

  let errorCount = 0;
  const initializedFiles: { relPath: string; id: string }[] = [];

  for (const filePath of filePaths) {
    if (!existsSync(filePath)) {
      printError(
        `ERROR: ファイル [${relative(cwd, filePath)}] が見つかりません`,
      );
      errorCount++;
      continue;
    }

    try {
      const parsed = parseFile(filePath, cwd);

      // 既に x-st-id が存在する場合はスキップ
      if (parsed.frontMatter.id) {
        continue;
      }

      const ext = parsed.ext as TargetExtension;
      const template =
        config.frontMatterTemplate[ext] ??
        config.frontMatterTemplate.md ??
        DEFAULT_CONFIG.frontMatterTemplate.md!;

      const ctx = buildContext({
        config,
        doc: parsed,
        commandName: "init",
        cwd,
      });

      const initialFields: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(template)) {
        initialFields[key] =
          typeof value === "string" ? expandTemplate(value, ctx) : value;
      }

      const updated = addFrontMatter(parsed, initialFields);
      if (!options.dryRun) {
        writeDocument(updated);
      }

      const id = updated.frontMatter.id ?? "(ID未設定)";
      const relPath = relative(cwd, filePath);
      initializedFiles.push({ relPath, id });
    } catch (err) {
      printError(
        `❌ ${relative(cwd, filePath)}: ${err instanceof Error ? err.message : String(err)}`,
      );
      errorCount++;
    }
  }

  if (initializedFiles.length > 0) {
    const prefix = options.dryRun ? "[DRY RUN] " : "";
    console.log(`\n✨ ${prefix}以下のファイルを追跡対象として初期化しました:`);
    for (const { relPath, id } of initializedFiles) {
      console.log(`  📄 ${relPath} (ID: ${id})`);
    }
  } else if (filePaths.length === 0) {
    console.log(`ℹ️  初期化対象のファイルが見つかりません`);
  } else if (errorCount === 0) {
    console.log(`ℹ️  すべてのファイルは既に初期化済みです`);
  }

  return errorCount > 0 ? ExitCode.ERROR : ExitCode.SUCCESS;
}
