import { readFileSync } from "node:fs";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";
import type { Config } from "../types/config.js";
import { DEFAULT_CONFIG } from "../types/config.js";
import { ConfigNotFoundError } from "../types/errors.js";
import { SPECTRACK_CONFIG_FILE } from "./defaults.js";
import { parseConfig } from "./schema.js";

/**
 * 指定ディレクトリから spectrack.yml を検索してロードする
 * @param cwd - 検索を開始するディレクトリ (default: process.cwd())
 * @param required - true の場合、設定ファイルが存在しない時にエラーを投げる
 */
export function loadConfig(
  cwd: string = process.cwd(),
  required = true,
): Config {
  const configPath = join(cwd, SPECTRACK_CONFIG_FILE);

  if (!existsSync(configPath)) {
    if (required) {
      throw new ConfigNotFoundError();
    }
    return DEFAULT_CONFIG;
  }

  const content = readFileSync(configPath, "utf-8");
  const raw = parseYaml(content) as unknown;
  return parseConfig(raw);
}

/**
 * spectrack.yml が存在するか確認する
 */
export function configExists(cwd: string = process.cwd()): boolean {
  return existsSync(join(cwd, SPECTRACK_CONFIG_FILE));
}
