import { existsSync } from "node:fs";
import { relative } from "node:path";
import semver from "semver";
import { ExitCode } from "../../output/exit-code.js";
import { printError } from "../../output/formatter.js";
import { parseFile } from "../../frontmatter/parser.js";
import { updateFrontMatter, writeDocument } from "../../frontmatter/writer.js";
import { resolveVersion } from "../../version/version-resolver.js";
import type { CommandContext } from "../runner.js";

export type BumpOptions = {
  readonly major?: boolean;
  readonly minor?: boolean;
  readonly patch?: boolean;
  readonly dryRun?: boolean;
};

/**
 * `spectrack bump <file> [--major|--minor|--patch] [--dry-run]`
 *
 * ドキュメントのバージョンをSemVerに従って引き上げる。
 */
export async function runBump(
  filePath: string,
  options: BumpOptions,
  ctx: CommandContext,
): Promise<ExitCode> {
  if (!existsSync(filePath)) {
    printError(`ERROR: ファイル [${relative(ctx.cwd, filePath)}] が見つかりません`);
    return ExitCode.ERROR;
  }

  const parsed = parseFile(filePath, ctx.cwd);
  const relPath = relative(ctx.cwd, filePath);

  const currentVersion = resolveVersion(parsed);
  if (!currentVersion) {
    printError(`ERROR: [${relPath}] にバージョンフィールドがありません`);
    return ExitCode.ERROR;
  }

  const releaseType: semver.ReleaseType = options.major
    ? "major"
    : options.minor
      ? "minor"
      : "patch";

  const newVersion = semver.inc(currentVersion, releaseType);
  if (!newVersion) {
    printError(`ERROR: [${currentVersion}] は有効なSemVerではありません`);
    return ExitCode.ERROR;
  }

  const versionPath = parsed.frontMatter.versionPath ?? "version";
  const updates = buildVersionUpdates(parsed.frontMatter.raw, versionPath, newVersion);
  const updated = updateFrontMatter(parsed, updates);

  if (options.dryRun) {
    console.log(`[DRY RUN] ⬆️ バージョン更新: ${relPath}`);
    console.log(`  📌 バージョン: ${currentVersion} → ${newVersion}`);
    return ExitCode.SUCCESS;
  }

  writeDocument(updated);

  console.log(`⬆️ バージョン更新完了`);
  console.log(`  📄 ファイル: ${relPath}`);
  console.log(`  📌 バージョン: ${currentVersion} → ${newVersion}`);

  return ExitCode.SUCCESS;
}

/**
 * バージョンパスに対応する更新オブジェクトを構築する
 * ネストされたパス（例: info.version）もサポートする
 */
export function buildVersionUpdates(
  raw: Record<string, unknown>,
  versionPath: string,
  version: string,
): Record<string, unknown> {
  const updates: Record<string, unknown> = {};

  if (versionPath.includes(".")) {
    const pathParts = versionPath.split(".");
    const topKey = pathParts[0]!;
    const topObj = (raw[topKey] as Record<string, unknown>) ?? {};

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

    updates[topKey] = updateNested({ ...topObj }, pathParts.slice(1), version);
  } else {
    updates[versionPath] = version;
  }

  return updates;
}
