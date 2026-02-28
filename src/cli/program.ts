import { Command } from "commander";
import { resolve } from "node:path";
import { ExitCode } from "../output/exit-code.js";
import { printError } from "../output/formatter.js";
import { initCommandContext } from "./runner.js";
import { runInit } from "./commands/init.js";
import { runVerify } from "./commands/verify.js";
import { runGraph } from "./commands/graph.js";
// v2/v3 commands
import { runLink } from "./commands/link.js";
import { runDepsDiff } from "./commands/deps-diff.js";
import { runUnlink } from "./commands/unlink.js";
import { runBump } from "./commands/bump.js";
import { runSync } from "./commands/sync.js";
import { runStatus } from "./commands/status.js";
import { runList } from "./commands/list.js";
import { runDependents } from "./commands/dependents.js";
import { runLog } from "./commands/log.js";

export function createProgram(): Command {
  const program = new Command();

  program
    .name("spectrack")
    .description("仕様書依存関係追跡ツール")
    .version("0.1.0");

  // ── v2 commands ──────────────────────────────────────

  // spectrack init
  program
    .command("init [files...]")
    .description("設定ファイルを作成し、ドキュメントを初期化する")
    .option("--all", "プロジェクト内の全ファイルにフロントマターを一括追加する")
    .option("--dry-run", "実際の書き込みを行わず変更内容を表示する")
    .option("-y, --yes", "--all 指定時の確認プロンプトをスキップする")
    .action(
      async (
        files: string[],
        opts: { all?: boolean; dryRun?: boolean; yes?: boolean },
      ) => {
        const cwd = process.cwd();
        const code = await runInit(
          {
            ...(files.length > 0 && {
              files: files.map((f) => resolve(cwd, f)),
            }),
            all: opts.all ?? false,
            dryRun: opts.dryRun ?? false,
            yes: opts.yes ?? false,
          },
          cwd,
        );
        process.exit(code);
      },
    );

  // spectrack link
  program
    .command("link <file>")
    .description("ファイル間の依存関係を結ぶ")
    .requiredOption(
      "--deps <deps>",
      "依存先をカンマ区切りのファイルパスで指定 (例: path[:version],...)",
    )
    .option("--dry-run", "実際の書き込みを行わず変更内容を表示する")
    .action(
      async (file: string, opts: { deps: string; dryRun?: boolean }) => {
        const filePath = resolve(process.cwd(), file);
        const code = await withContext(true, async (ctx) =>
          runLink(
            filePath,
            {
              deps: opts.deps,
              ...(opts.dryRun !== undefined && { dryRun: opts.dryRun }),
            },
            ctx,
          ),
        );
        process.exit(code);
      },
    );

  // spectrack unlink
  program
    .command("unlink <file>")
    .description("ファイル間の依存関係を解除する")
    .requiredOption(
      "--deps <deps>",
      "依存解除するファイルパスをカンマ区切りで指定",
    )
    .option("--dry-run", "実際の書き込みを行わず変更内容を表示する")
    .action(
      async (file: string, opts: { deps: string; dryRun?: boolean }) => {
        const filePath = resolve(process.cwd(), file);
        const code = await withContext(true, async (ctx) =>
          runUnlink(
            filePath,
            {
              deps: opts.deps,
              ...(opts.dryRun !== undefined && { dryRun: opts.dryRun }),
            },
            ctx,
          ),
        );
        process.exit(code);
      },
    );

  // spectrack bump
  program
    .command("bump <file>")
    .description("ドキュメントのバージョンをSemVerに従って引き上げる")
    .option("--major", "メジャーバージョンを更新")
    .option("--minor", "マイナーバージョンを更新")
    .option("--patch", "パッチバージョンを更新 (デフォルト)")
    .option("--dry-run", "実際の書き込みを行わず変更内容を表示する")
    .action(
      async (
        file: string,
        opts: { major?: boolean; minor?: boolean; patch?: boolean; dryRun?: boolean },
      ) => {
        const filePath = resolve(process.cwd(), file);
        const code = await withContext(true, async (ctx) =>
          runBump(filePath, opts, ctx),
        );
        process.exit(code);
      },
    );

  // spectrack sync
  program
    .command("sync <file>")
    .description("依存バージョンをWorking treeの最新バージョンに同期する")
    .option(
      "--only <ids>",
      "同期する依存先を指定 (ファイルパスまたはIDをカンマ区切りで)",
    )
    .option("--dry-run", "実際の書き込みを行わず変更内容を表示する")
    .action(
      async (file: string, opts: { only?: string; dryRun?: boolean }) => {
        const filePath = resolve(process.cwd(), file);
        const code = await withContext(true, async (ctx) =>
          runSync(filePath, opts, ctx),
        );
        process.exit(code);
      },
    );

  // spectrack status
  program
    .command("status [file]")
    .description("ドキュメントの依存状況をWorking treeベースでチェックする")
    .option("--strict", "パッチ更新も更新ありとみなす")
    .action(async (file: string | undefined, opts: { strict?: boolean }) => {
      const filePath = file ? resolve(process.cwd(), file) : undefined;
      const code = await withContext(true, async (ctx) =>
        runStatus(filePath, opts, ctx),
      );
      process.exit(code);
    });

  // spectrack list
  program
    .command("list")
    .description("全追跡対象ドキュメントのインベントリを表示する")
    .action(async () => {
      const code = await withContext(true, async (ctx) => runList(ctx));
      process.exit(code);
    });

  // spectrack dependents
  program
    .command("dependents <file>")
    .description("指定ドキュメントに依存しているドキュメントを検索する")
    .action(async (file: string) => {
      const filePath = resolve(process.cwd(), file);
      const code = await withContext(true, async (ctx) =>
        runDependents(filePath, ctx),
      );
      process.exit(code);
    });

  // spectrack deps-diff
  program
    .command("deps-diff <file>")
    .description("依存先ドキュメントの参照バージョンからの差分を表示する")
    .action(async (file: string) => {
      const filePath = resolve(process.cwd(), file);
      const code = await withContext(true, async (ctx) =>
        runDepsDiff(filePath, ctx),
      );
      process.exit(code);
    });

  // spectrack log
  program
    .command("log <file>")
    .description("ドキュメントのバージョン変更履歴を表示する")
    .option("--diff <version>", "指定バージョンとの差分を表示する")
    .action(async (file: string, opts: { diff?: string }) => {
      const filePath = resolve(process.cwd(), file);
      const code = await withContext(true, async (ctx) =>
        runLog(
          filePath,
          { ...(opts.diff !== undefined && { diff: opts.diff }) },
          ctx,
        ),
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
        runVerify(
          { ...(opts.allowCycles !== undefined && { allowCycles: opts.allowCycles }) },
          ctx,
        ),
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
        runGraph(
          { ...(opts.format !== undefined && { format: opts.format }) },
          ctx,
        ),
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
