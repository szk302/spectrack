import { existsSync } from "node:fs";
import { relative } from "node:path";
import { ExitCode } from "../../output/exit-code.js";
import { printError, SEPARATOR, TREE, formatDepStatus } from "../../output/formatter.js";
import { parseFile } from "../../frontmatter/parser.js";
import { resolveVersion } from "../../version/version-resolver.js";
import { getCommittedVersion } from "../../git/history-resolver.js";
import { isUpdated } from "../../version/semver-utils.js";
import type { CommandContext } from "../runner.js";
import { resolveId } from "../../scanner/id-registry.js";

export async function runShowDeps(
  filePath: string | undefined,
  ctx: CommandContext,
): Promise<ExitCode> {
  let exitCode: ExitCode = ExitCode.SUCCESS;

  const targetDocs = filePath
    ? (() => {
        if (!existsSync(filePath)) {
          printError(`ERROR: ファイル [${filePath}] が見つかりません`);
          return null;
        }
        const parsed = parseFile(filePath, ctx.cwd);
        const currentVersion = resolveVersion(parsed);
        return [{ ...parsed, currentVersion }];
      })()
    : ctx.docs;

  if (!targetDocs) return ExitCode.ERROR;

  for (const doc of targetDocs) {
    if (doc.frontMatter.dependencies.length === 0) continue;

    const docId = doc.frontMatter.id ?? "(不明)";
    const docRelPath = relative(ctx.cwd, doc.filePath);
    const docVersion = doc.currentVersion ?? "?";

    // ドキュメントの最新コミットハッシュを取得
    let docHash: string | null = null;
    try {
      const log = await ctx.git.log({
        file: docRelPath,
        maxCount: 1,
      });
      docHash = log.latest?.hash?.slice(0, 7) ?? null;
    } catch {
      // ignore
    }

    const hashStr = docHash ? ` @ ${docHash}` : "";
    console.log(SEPARATOR);
    console.log(
      `📄 [${docId}] ${docRelPath} (${docVersion}${hashStr}) の依存先:`,
    );

    const depCount = doc.frontMatter.dependencies.length;
    for (let i = 0; i < depCount; i++) {
      const dep = doc.frontMatter.dependencies[i]!;
      const connector = i === depCount - 1 ? TREE.LAST : TREE.BRANCH;

      const entry = resolveId(ctx.idRegistry, dep.id);
      if (!entry) {
        console.log(`   ${connector} ❌ [${dep.id}] 見つかりません`);
        exitCode = ExitCode.ERROR;
        continue;
      }

      // 依存先の HEAD コミット時点のバージョンを取得
      const depDoc = ctx.docs.find((d) => d.frontMatter.id === dep.id);
      const vPath = depDoc?.frontMatter.versionPath ?? "version";

      const { version: committedVersion, commitHash } =
        await getCommittedVersion(ctx.git, entry.relativePath, vPath);

      const hasUpdate =
        committedVersion !== null
          ? isUpdated(dep.version, committedVersion)
          : false;

      if (hasUpdate && exitCode === ExitCode.SUCCESS) {
        exitCode = ExitCode.WARNING;
      }

      const line = formatDepStatus(
        dep.id,
        entry.relativePath,
        dep.version,
        committedVersion,
        commitHash,
        hasUpdate,
      );
      console.log(`   ${connector} ${line}`);
    }
  }

  return exitCode;
}
