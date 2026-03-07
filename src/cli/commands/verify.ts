import { relative } from "node:path";
import { ExitCode } from "../../output/exit-code.js";
import { printError } from "../../output/formatter.js";
import { detectCycles, formatCycle } from "../../dependency/cycle-detector.js";
import { buildDependencyGraph } from "../../dependency/dependency-graph.js";
import { validateVersion } from "../../version/semver-utils.js";
import { InvalidPrereleaseError } from "../../types/errors.js";
import type { CommandContext } from "../runner.js";
import { resolveId } from "../../scanner/id-registry.js";

export type VerifyOptions = {
  readonly allowCycles?: boolean;
};

export async function runVerify(
  options: VerifyOptions,
  ctx: CommandContext,
): Promise<ExitCode> {
  const total = ctx.docs.length;
  console.log(`✅ 検証開始: ${total} 個のドキュメントを検査中...\n`);

  let exitCode: ExitCode = ExitCode.SUCCESS;

  // フロントマター構造チェック（パースエラー含む）
  let frontMatterOk = 0;
  const frontMatterErrors: string[] = [...ctx.parseErrors];
  for (const doc of ctx.docs) {
    const relPath = relative(ctx.cwd, doc.filePath);
    if (!doc.frontMatter.id) {
      frontMatterErrors.push(`  - [${relPath}] x-st-id が設定されていません`);
    } else {
      frontMatterOk++;
    }
  }

  // ID 一意性チェック (buildIdRegistry で既にチェック済みだが再確認)
  const idCount = new Map<string, number>();
  for (const doc of ctx.docs) {
    const id = doc.frontMatter.id;
    if (id) {
      idCount.set(id, (idCount.get(id) ?? 0) + 1);
    }
  }
  const duplicateIds = [...idCount.entries()]
    .filter(([, count]) => count > 1)
    .map(([id]) => id);

  // 参照先確認
  let refOk = 0;
  const refErrors: string[] = [];
  for (const doc of ctx.docs) {
    for (const dep of doc.frontMatter.dependencies) {
      const entry = resolveId(ctx.idRegistry, dep.id);
      if (!entry) {
        refErrors.push(
          `  - [${doc.frontMatter.id ?? relative(ctx.cwd, doc.filePath)}] → [${dep.id}] が見つかりません`,
        );
      } else {
        refOk++;
      }
    }
  }

  // バージョン形式チェック
  let versionOk = 0;
  const versionErrors: string[] = [];
  const versionWarnings: string[] = [];
  for (const doc of ctx.docs) {
    const relPath = relative(ctx.cwd, doc.filePath);
    if (doc.currentVersion) {
      try {
        validateVersion(doc.currentVersion, relPath);
        versionOk++;
      } catch (err) {
        const msg = `  - ${err instanceof Error ? err.message : String(err)}`;
        if (err instanceof InvalidPrereleaseError) {
          versionErrors.push(msg);
        } else {
          versionWarnings.push(msg);
        }
      }
    } else if (doc.frontMatter.id && doc.frontMatter.versionPath) {
      // versionPath は設定されているがバージョン値が取得できない
      versionErrors.push(
        `  - [${relPath}] バージョン情報が取得できません (versionPath: ${doc.frontMatter.versionPath})`,
      );
    }
  }

  // 循環依存チェック
  const graph = buildDependencyGraph(ctx.docs);
  const cycles = detectCycles(graph);

  // 結果表示
  console.log("━".repeat(30));

  // フロントマター構造
  if (frontMatterErrors.length === 0) {
    console.log(`🔍 フロントマター構造: OK (${frontMatterOk}/${total})`);
  } else {
    console.log(
      `🔍 フロントマター構造: ❌ エラー (${frontMatterOk}/${total})`,
    );
    for (const e of frontMatterErrors) console.log(e);
    exitCode = ExitCode.ERROR;
  }

  // ID 一意性
  if (duplicateIds.length === 0) {
    console.log(`🆔 ID一意性: OK (${total}/${total})`);
  } else {
    console.log(`🆔 ID一意性: ❌ エラー`);
    for (const id of duplicateIds)
      console.log(`  - 重複ID: [${id}]`);
    exitCode = ExitCode.ERROR;
  }

  // 参照先確認
  const totalRefs = ctx.docs.reduce(
    (sum, d) => sum + d.frontMatter.dependencies.length,
    0,
  );
  if (refErrors.length === 0) {
    console.log(`📦 参照先確認: OK (${totalRefs}/${totalRefs})`);
  } else {
    console.log(
      `📦 参照先確認: ❌ エラー (${refOk}/${totalRefs})`,
    );
    for (const e of refErrors) console.log(e);
    exitCode = ExitCode.ERROR;
  }

  // 循環依存
  if (cycles.length === 0) {
    console.log(`🔄 循環依存: OK`);
  } else if (options.allowCycles) {
    console.log(`🔄 循環依存: ℹ️  許容 (${cycles.length} 個の循環参照)`);
    for (const cycle of cycles) console.log(`  - ${formatCycle(cycle)}`);
  } else {
    console.log(`🔄 循環依存: ⚠️ 警告 (${cycles.length} 個の循環参照検出)`);
    for (const cycle of cycles) console.log(`  - ${formatCycle(cycle)}`);
    if (exitCode === ExitCode.SUCCESS) exitCode = ExitCode.WARNING;
  }

  // バージョン形式
  if (versionErrors.length === 0 && versionWarnings.length === 0) {
    console.log(`📌 バージョン形式: OK (${versionOk}/${total})`);
  } else if (versionErrors.length > 0) {
    console.log(`📌 バージョン形式: ❌ エラー (${versionErrors.length} 件)`);
    for (const e of versionErrors) console.log(e);
    for (const w of versionWarnings) console.log(w);
    exitCode = ExitCode.ERROR;
  } else {
    console.log(`📌 バージョン形式: ⚠️ 警告 (${versionWarnings.length} 件)`);
    for (const w of versionWarnings) console.log(w);
    if (exitCode === ExitCode.SUCCESS) exitCode = ExitCode.WARNING;
  }

  console.log();
  if (exitCode === ExitCode.SUCCESS) {
    console.log(`✅ 検証完了: エラーなし`);
  } else if (exitCode === ExitCode.WARNING) {
    console.log(`✅ 検証完了: 警告 ${cycles.length + versionWarnings.length} 件`);
  } else {
    console.log(`❌ 検証完了: エラーあり`);
  }

  return exitCode;
}
