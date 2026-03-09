import type { Config } from "./config.js";
import type { Dependency } from "./document.js";

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
  readonly allowCycles?: boolean;
  readonly format?: string;
  readonly dryRun?: boolean;
  readonly only?: string;
  readonly major?: boolean;
  readonly minor?: boolean;
  readonly patch?: boolean;
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
  readonly utils: {
    readonly nanoid: string;
  };
};
