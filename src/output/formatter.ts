/**
 * コンソール出力のフォーマットユーティリティ
 * 絵文字・ツリー表示・区切り線等
 */

export const SEPARATOR = "━".repeat(30);

/** ツリー表示の接続文字 */
export const TREE = {
  BRANCH: "├─",
  LAST: "└─",
  PIPE: "│",
  SPACE: "  ",
} as const;

/**
 * 区切り線を出力する
 */
export function printSeparator(): void {
  console.log(SEPARATOR);
}

/**
 * 成功メッセージを出力する
 */
export function printSuccess(message: string): void {
  console.log(`✅ ${message}`);
}

/**
 * エラーメッセージを stderr に出力する
 */
export function printError(message: string): void {
  console.error(message);
}

/**
 * 警告メッセージを stderr に出力する
 */
export function printWarning(message: string): void {
  console.error(message);
}

/**
 * ツリーのアイテムを出力する
 * @param items - 表示するアイテムの配列
 * @param indent - インデント文字列
 */
export function printTreeItems(items: string[], indent = "  "): void {
  for (let i = 0; i < items.length; i++) {
    const connector = i === items.length - 1 ? TREE.LAST : TREE.BRANCH;
    console.log(`${indent}${connector} ${items[i]}`);
  }
}

/**
 * ファイル情報ヘッダーを出力する
 */
export function printDocHeader(
  id: string,
  relativePath: string,
  version?: string | null,
  commitHash?: string | null,
): void {
  const versionStr = version ? ` (${version}` : "";
  const hashStr = commitHash ? ` @ ${commitHash})` : version ? ")" : "";
  console.log(
    `${SEPARATOR}\n📄 [${id}] ${relativePath}${versionStr}${hashStr} の依存先:`,
  );
}

/**
 * 依存先ステータスを出力する
 */
export function formatDepStatus(
  id: string,
  relativePath: string,
  referenceVersion: string,
  currentVersion: string | null,
  commitHash: string | null,
  hasUpdate: boolean,
  isWorkingTree = false,
): string {
  const icon = hasUpdate ? "🔄" : "✅";
  const current = currentVersion ?? "不明";
  const hash = isWorkingTree
    ? " @ Working tree"
    : commitHash
      ? ` @ ${commitHash}`
      : "";
  const updateNote = hasUpdate ? " ⚠️ 更新あり" : "";
  return `${icon} [${id}] ${relativePath} (参照: ${referenceVersion}, 現在: ${current}${hash})${updateNote}`;
}
