import { readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import type { Ignore } from "ignore";
import type { TargetExtension } from "../config/defaults.js";
import { TARGET_EXTENSIONS } from "../config/defaults.js";

/**
 * documentRootPath 以下の対象拡張子ファイルをすべてスキャンする
 * @param documentRootPath - スキャン対象のルートディレクトリ（絶対パス）
 * @param ig - .spectrackignore の ignore インスタンス
 * @param cwd - プロジェクトルート（相対パス計算の基準）
 * @returns 絶対パスのリスト
 */
export function scanFiles(
  documentRootPath: string,
  ig: Ignore,
  cwd: string,
): string[] {
  const results: string[] = [];
  scanDir(documentRootPath, ig, cwd, results);
  return results;
}

function scanDir(
  dir: string,
  ig: Ignore,
  cwd: string,
  results: string[],
): void {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }

  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const relPath = relative(cwd, fullPath);

    if (ig.ignores(relPath)) {
      continue;
    }

    let stat;
    try {
      stat = statSync(fullPath);
    } catch {
      continue;
    }

    if (stat.isDirectory()) {
      scanDir(fullPath, ig, cwd, results);
    } else if (stat.isFile() && isTargetFile(entry)) {
      results.push(fullPath);
    }
  }
}

function isTargetFile(filename: string): boolean {
  const dot = filename.lastIndexOf(".");
  if (dot === -1) return false;
  const ext = filename.slice(dot + 1).toLowerCase();
  return (TARGET_EXTENSIONS as readonly string[]).includes(ext);
}

/**
 * ファイルパスから拡張子を取得する
 */
export function getExtension(filePath: string): TargetExtension | null {
  const dot = filePath.lastIndexOf(".");
  if (dot === -1) return null;
  const ext = filePath.slice(dot + 1).toLowerCase();
  if ((TARGET_EXTENSIONS as readonly string[]).includes(ext)) {
    return ext as TargetExtension;
  }
  return null;
}
