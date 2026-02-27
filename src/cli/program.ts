import { Command } from "commander";
import { resolve } from "node:path";
import { ExitCode } from "../output/exit-code.js";
import { printError } from "../output/formatter.js";
import { initCommandContext } from "./runner.js";
import { runInit } from "./commands/init.js";
import { runAdd } from "./commands/add.js";
import { runUpdate } from "./commands/update.js";
import { runCheckDeps } from "./commands/check-deps.js";
import { runShowDeps } from "./commands/show-deps.js";
import { runFindDependents } from "./commands/find-dependents.js";
import { runVerify } from "./commands/verify.js";
import { runListVersions } from "./commands/list-versions.js";
import { runDiff } from "./commands/diff.js";
import { runGraph } from "./commands/graph.js";

export function createProgram(): Command {
  const program = new Command();

  program
    .name("spectrack")
    .description("仕様書依存関係追跡ツール")
    .version("0.1.0");

  // spectrack init
  program
    .command("init")
    .description("設定ファイルを作成し、ドキュメントを初期化する")
    .option("--add-frontmatter", "フロントマターにメタデータを追加する")
    .action(async (opts: { addFrontmatter?: boolean }) => {
      const code = await runInit(
        { addFrontmatter: opts.addFrontmatter ?? false },
        process.cwd(),
      );
      process.exit(code);
    });

  // spectrack add
  program
    .command("add <file>")
    .description("指定ドキュメントにメタデータを追加する")
    .option(
      "--deps <deps>",
      "依存ドキュメントを指定 (形式: id:version,id:version,...)",
    )
    .action(async (file: string, opts: { deps?: string }) => {
      const filePath = resolve(process.cwd(), file);
      const code = await withContext(false, async (ctx) =>
        runAdd(filePath, { ...(opts.deps !== undefined && { deps: opts.deps }) }, ctx),
      );
      process.exit(code);
    });

  // spectrack update
  program
    .command("update <file>")
    .description("指定ドキュメントのメタデータを更新する")
    .option("--version <version>", "ドキュメントバージョンを更新")
    .option(
      "--add-deps <deps>",
      "依存ドキュメントを追加 (形式: id[:version|auto],...)",
    )
    .option("--remove-deps <deps>", "依存ドキュメントを削除 (形式: id,...)")
    .option("--upgrade-deps", "依存先バージョンをすべて最新にアップグレード")
    .action(
      async (
        file: string,
        opts: {
          version?: string;
          addDeps?: string;
          removeDeps?: string;
          upgradeDeps?: boolean;
        },
      ) => {
        const filePath = resolve(process.cwd(), file);
        const code = await withContext(true, async (ctx) =>
          runUpdate(
            filePath,
            {
              ...(opts.version !== undefined && { version: opts.version }),
              ...(opts.addDeps !== undefined && { addDeps: opts.addDeps }),
              ...(opts.removeDeps !== undefined && { removeDeps: opts.removeDeps }),
              ...(opts.upgradeDeps !== undefined && { upgradeDeps: opts.upgradeDeps }),
            },
            ctx,
          ),
        );
        process.exit(code);
      },
    );

  // spectrack check-deps
  program
    .command("check-deps [file]")
    .description("ドキュメントの依存先をチェックする")
    .option("--strict", "パッチ更新も更新ありとみなす")
    .action(async (file: string | undefined, opts: { strict?: boolean }) => {
      const filePath = file ? resolve(process.cwd(), file) : undefined;
      const code = await withContext(true, async (ctx) =>
        runCheckDeps(filePath, { ...(opts.strict !== undefined && { strict: opts.strict }) }, ctx),
      );
      process.exit(code);
    });

  // spectrack show-deps
  program
    .command("show-deps [file]")
    .description("ドキュメントの依存先をすべて表示する")
    .action(async (file: string | undefined) => {
      const filePath = file ? resolve(process.cwd(), file) : undefined;
      const code = await withContext(true, async (ctx) =>
        runShowDeps(filePath, ctx),
      );
      process.exit(code);
    });

  // spectrack find-dependents
  program
    .command("find-dependents <file>")
    .description("指定ドキュメントを依存先とするドキュメントを検索する")
    .action(async (file: string) => {
      const filePath = resolve(process.cwd(), file);
      const code = await withContext(true, async (ctx) =>
        runFindDependents(filePath, ctx),
      );
      process.exit(code);
    });

  // spectrack verify
  program
    .command("verify")
    .description("すべてのドキュメントの構造と依存関係を検証する")
    .option("--allow-cycles", "循環依存を許容する")
    .action(async (opts: { allowCycles?: boolean }) => {
      const code = await withContext(true, async (ctx) =>
        runVerify({ ...(opts.allowCycles !== undefined && { allowCycles: opts.allowCycles }) }, ctx),
      );
      process.exit(code);
    });

  // spectrack list-versions
  program
    .command("list-versions [file]")
    .description("ドキュメントのバージョン情報を表示する")
    .action(async (file: string | undefined) => {
      const filePath = file ? resolve(process.cwd(), file) : undefined;
      const code = await withContext(true, async (ctx) =>
        runListVersions(filePath, ctx),
      );
      process.exit(code);
    });

  // spectrack diff
  program
    .command("diff <file>")
    .description("指定バージョンとの差分を表示する")
    .requiredOption("--version <version>", "比較対象のバージョン")
    .action(async (file: string, opts: { version: string }) => {
      const filePath = resolve(process.cwd(), file);
      const code = await withContext(true, async (ctx) =>
        runDiff(filePath, { version: opts.version }, ctx),
      );
      process.exit(code);
    });

  // spectrack graph
  program
    .command("graph")
    .description("依存関係グラフを生成する")
    .option("--format <format>", "出力フォーマット (mermaid|dot|json)", "mermaid")
    .action(async (opts: { format?: string }) => {
      const code = await withContext(true, async (ctx) =>
        runGraph({ ...(opts.format !== undefined && { format: opts.format }) }, ctx),
      );
      process.exit(code);
    });

  return program;
}

async function withContext(
  configRequired: boolean,
  fn: (ctx: Awaited<ReturnType<typeof initCommandContext>>) => Promise<ExitCode>,
): Promise<ExitCode> {
  try {
    const ctx = await initCommandContext(process.cwd(), configRequired);
    return await fn(ctx);
  } catch (err) {
    printError(err instanceof Error ? err.message : String(err));
    return ExitCode.ERROR;
  }
}
