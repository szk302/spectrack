import type { SimpleGit } from "simple-git";
import type { Config } from "../types/config.js";
import type { VersionedDocument } from "../types/document.js";
import type { IdRegistry } from "../scanner/id-registry.js";
import { loadConfig } from "../config/loader.js";
import { loadIgnore } from "../scanner/ignore-parser.js";
import { scanFiles } from "../scanner/file-scanner.js";
import { parseFile } from "../frontmatter/parser.js";
import { buildIdRegistry } from "../scanner/id-registry.js";
import { resolveVersion } from "../version/version-resolver.js";
import { createGitClient, createGitClientOptional } from "../git/git-client.js";

/** コマンド実行時に共通で使用するコンテキスト */
export type CommandContext = {
  readonly config: Config;
  readonly docs: readonly VersionedDocument[];
  readonly idRegistry: IdRegistry;
  readonly git: SimpleGit;
  readonly cwd: string;
};

/** list コマンド専用コンテキスト（Git 未初期化環境でも動作する） */
export type ListCommandContext = {
  readonly config: Config;
  readonly docs: readonly VersionedDocument[];
  readonly idRegistry: IdRegistry;
  readonly git: SimpleGit | null;
  readonly cwd: string;
};

/**
 * コマンド実行前の共通初期化処理
 * 1. Git リポジトリ確認
 * 2. 設定ファイル読み込み
 * 3. ファイルスキャン + ID レジストリ構築
 */
export async function initCommandContext(
  cwd: string = process.cwd(),
  configRequired = true,
): Promise<CommandContext> {
  const git = await createGitClient(cwd);
  const config = loadConfig(cwd, configRequired);

  const ig = loadIgnore(cwd);
  const filePaths = scanFiles(cwd, ig, cwd);

  const docs: VersionedDocument[] = [];
  for (const filePath of filePaths) {
    try {
      const parsed = parseFile(filePath, cwd);
      const currentVersion = resolveVersion(parsed);
      docs.push({ ...parsed, currentVersion });
    } catch {
      // パースエラーは無視（verify コマンドで報告）
    }
  }

  const idRegistry = buildIdRegistry(docs, cwd);

  return { config, docs, idRegistry, git, cwd };
}

/**
 * list コマンド専用の初期化処理
 * Git が未初期化の場合でも動作する（git = null）
 */
export async function initListContext(
  cwd: string = process.cwd(),
): Promise<ListCommandContext> {
  const git = await createGitClientOptional(cwd);
  const config = loadConfig(cwd, true);

  const ig = loadIgnore(cwd);
  const filePaths = scanFiles(cwd, ig, cwd);

  const docs: VersionedDocument[] = [];
  for (const filePath of filePaths) {
    try {
      const parsed = parseFile(filePath, cwd);
      const currentVersion = resolveVersion(parsed);
      docs.push({ ...parsed, currentVersion });
    } catch {
      // パースエラーは無視
    }
  }

  const idRegistry = buildIdRegistry(docs, cwd);

  return { config, docs, idRegistry, git, cwd };
}

