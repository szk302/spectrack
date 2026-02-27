/** spectrack.yml の設定型 */
export type FrontMatterTemplateEntry = {
  /** バージョンパス (例: "version", "info.version") */
  readonly "x-st-version-path"?: string;
  /** ドキュメントID テンプレート (例: "{{context.file.dir}}-{{nanoid}}") */
  readonly "x-st-id"?: string;
  /** 依存先リスト初期値 */
  readonly "x-st-dependencies"?: readonly unknown[];
  /** その他のフィールド (version: 0.0.0 等) */
  readonly [key: string]: unknown;
};

export type FrontMatterTemplates = {
  readonly md?: FrontMatterTemplateEntry;
  readonly yml?: FrontMatterTemplateEntry;
  readonly yaml?: FrontMatterTemplateEntry;
};

export type Config = {
  /** フロントマターキープレフィックス (default: "x-st-") */
  readonly frontMatterKeyPrefix: string;
  /** ドキュメントルートパス (default: "doc") */
  readonly documentRootPath: string;
  /** フロントマターテンプレート */
  readonly frontMatterTemplate: FrontMatterTemplates;
};

export const DEFAULT_CONFIG: Config = {
  frontMatterKeyPrefix: "x-st-",
  documentRootPath: "doc",
  frontMatterTemplate: {
    md: {
      version: "0.0.0",
      "x-st-version-path": "version",
      "x-st-id": "{{context.file.dir}}-{{nanoid}}",
      "x-st-dependencies": [],
    },
    yml: {
      "x-st-version-path": "info.version",
      "x-st-id": "{{context.file.dir}}-{{nanoid}}",
      "x-st-dependencies": [],
    },
    yaml: {
      "x-st-version-path": "info.version",
      "x-st-id": "{{context.file.dir}}-{{nanoid}}",
      "x-st-dependencies": [],
    },
  },
} as const;
