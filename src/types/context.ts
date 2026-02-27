import type { Config } from "./config.js";
import type { Dependency } from "./document.js";

/** コマンド実行時のオプション (check-deps 用) */
export type CheckDepsOptions = {
  readonly strict?: boolean;
};

/** コマンド実行時のオプション (update 用) */
export type UpdateOptions = {
  readonly version?: string;
  readonly addDeps?: readonly string[];
  readonly removeDeps?: readonly string[];
  readonly upgradeDeps?: boolean;
};

/** コマンド引数の構造化表現 */
export type CommandArgs = {
  readonly file?: string;
};

/** コマンドオプションの構造化表現 */
export type CommandOptions = {
  readonly deps?: string;
  readonly depsStructured?: readonly Dependency[];
  readonly version?: string;
  readonly strict?: boolean;
  readonly upgradeDeps?: boolean;
  readonly addDeps?: readonly string[];
  readonly removeDeps?: readonly string[];
  readonly allowCycles?: boolean;
  readonly format?: string;
};

/** コンテキスト情報 (spec §4) */
export type Context = {
  readonly config: Config;
  readonly file: {
    readonly path: string;
    readonly name: string;
    readonly ext: string;
    readonly dir: string;
  };
  readonly frontMatter: {
    readonly "x-st-id"?: string;
    readonly "x-st-version-path"?: string;
    readonly "x-st-dependencies"?: readonly Dependency[];
    readonly [key: string]: unknown;
  };
  readonly current: {
    readonly version: string | null;
  };
  readonly lastCommit: {
    readonly version: string | null;
    readonly updatedAt: string | null;
  };
  readonly previous: {
    readonly version: string | null;
    readonly updatedAt: string | null;
  };
  readonly command: {
    readonly name: string;
    readonly args: CommandArgs;
    readonly options: CommandOptions;
  };
  readonly macro: {
    readonly nanoid: string;
  };
};
