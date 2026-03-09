import { existsSync } from "node:fs";
import { extname, relative } from "node:path";
import semver from "semver";
import { TARGET_EXTENSIONS } from "../../config/defaults.js";
import { ExitCode } from "../../output/exit-code.js";
import { printError } from "../../output/formatter.js";
import { parseFile } from "../../frontmatter/parser.js";
import { updateFrontMatter, writeDocument } from "../../frontmatter/writer.js";
import { resolveDotPath } from "../../frontmatter/template-engine.js";
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
  const relPath = relative(ctx.cwd, filePath);

  // E5-2: ファイル存在確認
  if (!existsSync(filePath)) {
    printError(`ERROR: ファイル [${relPath}] が見つかりません`);
    return ExitCode.ERROR;
  }

  // E5-3: サポート外拡張子チェック
  const ext = extname(filePath).slice(1).toLowerCase();
  if (ext && !(TARGET_EXTENSIONS as readonly string[]).includes(ext)) {
    printError(`ERROR: [.${ext}] はサポートされていない拡張子です`);
    return ExitCode.ERROR;
  }

  // C2-1: 更新種別オプションの欠落チェック
  const bumpFlags = [options.major, options.minor, options.patch].filter(Boolean).length;
  if (bumpFlags === 0) {
    printError("ERROR: --major, --minor, --patch のいずれかを指定してください");
    return ExitCode.ERROR;
  }

  // C2-2: 更新種別オプションの複数指定チェック
  if (bumpFlags > 1) {
    printError("ERROR: --major, --minor, --patch は排他指定です。1つのみ指定してください");
    return ExitCode.ERROR;
  }

  const parsed = parseFile(filePath, ctx.cwd);

  // M6-1 & M6-2: バージョンパス設定チェック
  const versionPath = parsed.frontMatter.versionPath;
  if (!versionPath) {
    printError(`ERROR: [${relPath}] バージョンパスが設定されていません（x-st-version-path を指定してください）`);
    return ExitCode.ERROR;
  }

  // P4-2: バージョンパスの解決チェック
  const rawValue = resolveDotPath(parsed.frontMatter.raw, versionPath);
  if (rawValue === undefined || rawValue === null) {
    printError(`ERROR: [${relPath}] 指定されたバージョンパスが見つかりません: ${versionPath}`);
    return ExitCode.ERROR;
  }

  // M6-4: バージョン値の型チェック
  if (typeof rawValue !== "string") {
    printError(`ERROR: [${relPath}] バージョン値が文字列型ではありません`);
    return ExitCode.ERROR;
  }

  // M6-3: バージョン値の空チェック
  if (rawValue === "") {
    printError(`ERROR: [${relPath}] 現在のバージョンが取得できません（空です）`);
    return ExitCode.ERROR;
  }

  // S3-3: v プレフィックスチェック（semver ライブラリは許容するが仕様上は不正）
  if (/^v/i.test(rawValue)) {
    printError(`ERROR: [${rawValue}] は有効なSemVerではありません（v プレフィックスは使用できません）`);
    return ExitCode.ERROR;
  }

  // S3-2: プレリリース英字チェック
  const semverParsed = semver.parse(rawValue);
  if (semverParsed && semverParsed.prerelease.length > 0) {
    const hasAlpha = semverParsed.prerelease.some((id) => typeof id === "string");
    if (hasAlpha) {
      printError(`ERROR: プレリリースバージョンは数値のみ許可されています: ${rawValue}`);
      return ExitCode.ERROR;
    }
  }

  // S3-3: SemVer有効性チェック
  const releaseType: semver.ReleaseType = options.major
    ? "major"
    : options.minor
      ? "minor"
      : "patch";

  const newVersion = semver.inc(rawValue, releaseType);
  if (!newVersion) {
    printError(`ERROR: [${rawValue}] は有効なSemVerではありません`);
    return ExitCode.ERROR;
  }

  const updates = buildVersionUpdates(parsed.frontMatter.raw, versionPath, newVersion);
  const updated = updateFrontMatter(parsed, updates);

  if (options.dryRun) {
    console.log(`[DRY RUN] ⬆️ バージョン更新: ${relPath}`);
    console.log(`  📌 バージョン: ${rawValue} → ${newVersion}`);
    return ExitCode.SUCCESS;
  }

  writeDocument(updated);

  console.log(`⬆️ バージョン更新完了`);
  console.log(`  📄 ファイル: ${relPath}`);
  console.log(`  📌 バージョン: ${rawValue} → ${newVersion}`);

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
