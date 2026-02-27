import { readFileSync } from "node:fs";
import { basename, dirname, relative } from "node:path";
import { parseDocument } from "yaml";
import type { TargetExtension } from "../config/defaults.js";
import type { Dependency, FrontMatter, ParsedDocument } from "../types/document.js";
import { InvalidFrontMatterError } from "../types/errors.js";
import { splitFrontMatter } from "./md-handler.js";

/**
 * ファイルをパースして ParsedDocument を返す
 * yaml パッケージの Document (AST) を保持することでコメント・インデントを維持する
 */
export function parseFile(
  filePath: string,
  cwd: string,
): ParsedDocument {
  const rawContent = readFileSync(filePath, "utf-8");
  const relativePath = relative(cwd, filePath);
  const ext = getFileExtension(filePath);

  if (ext === "md") {
    return parseMdFile(filePath, relativePath, rawContent, ext);
  } else {
    return parseYamlFile(filePath, relativePath, rawContent, ext);
  }
}

/**
 * 文字列コンテンツから ParsedDocument を生成する（テスト用）
 */
export function parseContent(
  content: string,
  filePath: string,
  ext: TargetExtension,
  cwd: string,
): ParsedDocument {
  const relativePath = relative(cwd, filePath);

  if (ext === "md") {
    return parseMdFile(filePath, relativePath, content, ext);
  } else {
    return parseYamlFile(filePath, relativePath, content, ext);
  }
}

function parseMdFile(
  filePath: string,
  relativePath: string,
  rawContent: string,
  ext: "md",
): ParsedDocument {
  const { frontMatterStr, body, hasFrontMatter } = splitFrontMatter(rawContent);

  if (!hasFrontMatter) {
    const emptyDoc = parseDocument("");
    return {
      filePath,
      relativePath,
      ext,
      frontMatter: extractFrontMatter(emptyDoc, relativePath),
      yamlDoc: emptyDoc,
      body: rawContent,
      rawContent,
    };
  }

  let yamlDoc;
  try {
    yamlDoc = parseDocument(frontMatterStr);
  } catch {
    throw new InvalidFrontMatterError(relativePath);
  }

  if (yamlDoc.errors.length > 0) {
    throw new InvalidFrontMatterError(relativePath);
  }

  return {
    filePath,
    relativePath,
    ext,
    frontMatter: extractFrontMatter(yamlDoc, relativePath),
    yamlDoc,
    body,
    rawContent,
  };
}

function parseYamlFile(
  filePath: string,
  relativePath: string,
  rawContent: string,
  ext: "yml" | "yaml",
): ParsedDocument {
  let yamlDoc;
  try {
    yamlDoc = parseDocument(rawContent);
  } catch {
    throw new InvalidFrontMatterError(relativePath);
  }

  if (yamlDoc.errors.length > 0) {
    throw new InvalidFrontMatterError(relativePath);
  }

  return {
    filePath,
    relativePath,
    ext,
    frontMatter: extractFrontMatter(yamlDoc, relativePath),
    yamlDoc,
    body: null,
    rawContent,
  };
}

function extractFrontMatter(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  yamlDoc: ReturnType<typeof parseDocument<any>>,
  _relativePath: string,
): FrontMatter {
  const raw = (yamlDoc.toJSON() ?? {}) as Record<string, unknown>;

  const id = typeof raw["x-st-id"] === "string" ? raw["x-st-id"] : undefined;
  const versionPath =
    typeof raw["x-st-version-path"] === "string"
      ? raw["x-st-version-path"]
      : undefined;

  const rawDeps = raw["x-st-dependencies"];
  const dependencies: Dependency[] = [];

  if (Array.isArray(rawDeps)) {
    for (const dep of rawDeps) {
      if (
        dep !== null &&
        typeof dep === "object" &&
        typeof (dep as Record<string, unknown>)["id"] === "string" &&
        typeof (dep as Record<string, unknown>)["version"] === "string"
      ) {
        dependencies.push({
          id: (dep as { id: string }).id,
          version: (dep as { version: string }).version,
        });
      }
    }
  }

  return {
    id,
    versionPath,
    dependencies,
    raw,
  };
}

function getFileExtension(filePath: string): TargetExtension {
  const name = basename(filePath);
  const dot = name.lastIndexOf(".");
  if (dot === -1) return "md";
  const ext = name.slice(dot + 1).toLowerCase();
  if (ext === "yml" || ext === "yaml" || ext === "md") {
    return ext;
  }
  return "md";
}
