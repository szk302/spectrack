import { readFileSync } from "node:fs";
import { existsSync } from "node:fs";
import { join } from "node:path";
import ignore, { type Ignore } from "ignore";
import { SPECTRACKIGNORE_FILE } from "../config/defaults.js";

/**
 * .spectrackignore を読み込んで ignore インスタンスを返す
 */
export function loadIgnore(cwd: string = process.cwd()): Ignore {
  const ig = ignore();
  const ignorePath = join(cwd, SPECTRACKIGNORE_FILE);

  if (existsSync(ignorePath)) {
    const content = readFileSync(ignorePath, "utf-8");
    ig.add(content);
  }

  return ig;
}

/**
 * 指定パスが無視対象かチェックする
 * @param ig - ignore インスタンス
 * @param relativePath - cwd からの相対パス
 */
export function isIgnored(ig: Ignore, relativePath: string): boolean {
  return ig.ignores(relativePath);
}
