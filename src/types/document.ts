import type { Document as YamlDocument } from "yaml";

/** ドキュメントの依存先エントリ */
export type Dependency = {
  readonly id: string;
  /** パスヒント: 人間用の補助情報（ツールが自動更新する）。追跡の正は id */
  readonly path?: string;
  readonly version: string;
};

/** フロントマターのメタデータ */
export type FrontMatter = {
  readonly id: string | undefined;
  readonly versionPath: string | undefined;
  readonly dependencies: readonly Dependency[];
  /** 生のフロントマターフィールド（全フィールド） */
  readonly raw: Record<string, unknown>;
};

/** パース済みドキュメント */
export type ParsedDocument = {
  /** ファイルの絶対パス */
  readonly filePath: string;
  /** ファイルの相対パス (cwd基準) */
  readonly relativePath: string;
  /** ファイル拡張子 */
  readonly ext: "md" | "yml" | "yaml";
  /** フロントマター情報 */
  readonly frontMatter: FrontMatter;
  /** yaml パッケージの Document (AST保持) */
  readonly yamlDoc: YamlDocument;
  /** .md ファイルの場合のフロントマター以降の本文 */
  readonly body: string | null;
  /** ファイルの生テキスト */
  readonly rawContent: string;
};

/** バージョン付きドキュメント情報 */
export type VersionedDocument = ParsedDocument & {
  /** 現在のバージョン (x-st-version-path で解決) */
  readonly currentVersion: string | null;
};

/** IDレジストリのエントリ */
export type RegistryEntry = {
  readonly id: string;
  readonly filePath: string;
  readonly relativePath: string;
};
