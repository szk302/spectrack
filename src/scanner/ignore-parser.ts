import { readFileSync } from "node:fs";
import { existsSync } from "node:fs";
import { join } from "node:path";
import ignore, { type Ignore } from "ignore";
import { SPECTRACK_CONFIG_FILE, SPECTRACKIGNORE_FILE } from "../config/defaults.js";

/**
 * .spectrackignore を読み込んで ignore インスタンスを返す
 * spectrack.yml と .spectrackignore は常に除外対象とする
 */
export function loadIgnore(cwd: string = process.cwd()): Ignore {
  const ig = ignore();

  // spectrack 設定ファイルは追跡対象外
  ig.add(SPECTRACK_CONFIG_FILE);
  ig.add(SPECTRACKIGNORE_FILE);

  const ignorePath = join(cwd, SPECTRACKIGNORE_FILE);
  if (existsSync(ignorePath)) {
    const content = readFileSync(ignorePath, "utf-8");
    ig.add(content);
  }

  return ig;
}

