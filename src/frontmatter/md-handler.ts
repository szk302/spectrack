/**
 * Markdown ファイルのフロントマター区切り処理
 * --- で囲まれた YAML フロントマターを検出・分割・結合する
 */

// 空のフロントマター (---\n---) にも対応するため \r?\n は optional
const FRONTMATTER_PATTERN = /^---\r?\n([\s\S]*?)(?:\r?\n)?---(?:\r?\n|$)/;

export type SplitResult = {
  /** フロントマターの YAML 文字列（--- を含まない） */
  readonly frontMatterStr: string;
  /** フロントマター以降の本文 */
  readonly body: string;
  /** フロントマターが存在したか */
  readonly hasFrontMatter: boolean;
};

/**
 * Markdown ファイルの内容をフロントマターと本文に分割する
 */
export function splitFrontMatter(content: string): SplitResult {
  const match = FRONTMATTER_PATTERN.exec(content);

  if (!match) {
    return {
      frontMatterStr: "",
      body: content,
      hasFrontMatter: false,
    };
  }

  const fullMatch = match[0];
  const frontMatterStr = match[1] ?? "";
  const body = content.slice(fullMatch.length);

  return {
    frontMatterStr,
    body,
    hasFrontMatter: true,
  };
}

/**
 * フロントマター YAML 文字列と本文を結合して Markdown 文字列を生成する
 */
export function joinFrontMatter(frontMatterStr: string, body: string): string {
  const normalizedBody = body.startsWith("\n") ? body : `\n${body}`;
  return `---\n${frontMatterStr}\n---${normalizedBody}`;
}

/**
 * フロントマターが存在しないファイルに新規フロントマターを挿入する
 */
export function insertFrontMatter(
  content: string,
  frontMatterStr: string,
): string {
  if (content.length === 0) {
    return `---\n${frontMatterStr}\n---\n`;
  }
  const separator = content.startsWith("\n") ? "" : "\n";
  return `---\n${frontMatterStr}\n---${separator}${content}`;
}
