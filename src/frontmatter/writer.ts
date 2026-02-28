import { writeFileSync } from "node:fs";
import { parseDocument, stringify } from "yaml";
import type { ParsedDocument } from "../types/document.js";
import { insertFrontMatter, joinFrontMatter } from "./md-handler.js";

/**
 * フロントマターの特定キーに値をセットした新しい ParsedDocument を返す
 * 元の Document は変更しない（不変性の原則）
 *
 * @param doc - 元のパース済みドキュメント
 * @param updates - 更新するキーと値のマップ
 */
export function updateFrontMatter(
  doc: ParsedDocument,
  updates: Record<string, unknown>,
): ParsedDocument {
  // Document をクローンして AST を保持しながら更新
  const clonedDoc = doc.yamlDoc.clone();

  for (const [key, value] of Object.entries(updates)) {
    clonedDoc.set(key, value);
  }

  // 更新後のフロントマターを再パースして frontMatter を再構築
  const updatedRaw = (clonedDoc.toJSON() ?? {}) as Record<string, unknown>;
  const updatedFrontMatter = {
    ...doc.frontMatter,
    id:
      typeof updatedRaw["x-st-id"] === "string"
        ? updatedRaw["x-st-id"]
        : doc.frontMatter.id,
    versionPath:
      typeof updatedRaw["x-st-version-path"] === "string"
        ? updatedRaw["x-st-version-path"]
        : doc.frontMatter.versionPath,
    dependencies: Array.isArray(updatedRaw["x-st-dependencies"])
      ? (updatedRaw["x-st-dependencies"] as Array<{
          id: string;
          path?: string;
          version: string;
        }>)
          .filter(
            (d) =>
              d !== null &&
              typeof d === "object" &&
              typeof d.id === "string" &&
              typeof d.version === "string",
          )
          .map((d) => ({
            id: d.id,
            ...(typeof d.path === "string" && { path: d.path }),
            version: d.version,
          }))
      : doc.frontMatter.dependencies,
    raw: updatedRaw,
  };

  return {
    ...doc,
    frontMatter: updatedFrontMatter,
    yamlDoc: clonedDoc,
  };
}

/**
 * ParsedDocument をファイルに書き込む
 * コメント・インデントなどの既存フォーマットを保持する
 */
export function writeDocument(doc: ParsedDocument): void {
  const content = serializeDocument(doc);
  writeFileSync(doc.filePath, content, "utf-8");
}

/**
 * ParsedDocument を文字列にシリアライズする
 */
export function serializeDocument(doc: ParsedDocument): string {
  const frontMatterStr = doc.yamlDoc.toString();

  if (doc.ext === "md") {
    if (doc.body !== null) {
      // 既存のフロントマターを更新する場合
      return joinFrontMatter(frontMatterStr, doc.body);
    } else {
      // フロントマターが存在しなかった場合は挿入
      return insertFrontMatter(doc.rawContent, frontMatterStr);
    }
  } else {
    // .yml/.yaml はファイル全体が YAML
    return frontMatterStr;
  }
}

/**
 * フロントマターが存在しないドキュメントに新規フロントマターを追加する
 * @param doc - フロントマターなしのパース済みドキュメント
 * @param initialFields - 初期フィールド
 */
export function addFrontMatter(
  doc: ParsedDocument,
  initialFields: Record<string, unknown>,
): ParsedDocument {
  // 新しいフロントマタードキュメントを作成
  const yamlStr = stringify(initialFields, { lineWidth: 0 });
  const newYamlDoc = parseDocument(yamlStr);

  const updatedRaw = (newYamlDoc.toJSON() ?? {}) as Record<string, unknown>;

  const updatedFrontMatter = {
    id:
      typeof updatedRaw["x-st-id"] === "string"
        ? updatedRaw["x-st-id"]
        : undefined,
    versionPath:
      typeof updatedRaw["x-st-version-path"] === "string"
        ? updatedRaw["x-st-version-path"]
        : undefined,
    dependencies: [],
    raw: updatedRaw,
  };

  return {
    ...doc,
    frontMatter: updatedFrontMatter,
    yamlDoc: newYamlDoc,
    body: doc.ext === "md" ? (doc.body ?? doc.rawContent) : null,
  };
}
